import SwiftUI
import WidgetKit

/// Must match APP_GROUP in src/widget/sync.ts and the entitlement in app.json.
let appGroup = "group.com.jophy.todolist"

// MARK: - Snapshot written by the app (src/widget/snapshot.ts)

struct SnapshotItem: Decodable {
  let title: String
  /// Milliseconds since 1970, or nil for tasks without a due date.
  let dueAt: Double?

  var due: Date? { dueAt.map { Date(timeIntervalSince1970: $0 / 1000) } }
}

struct StudyItem: Decodable {
  let name: String
  let remaining: Int
  let behind: Bool
}

struct PlantInfo: Decodable {
  let streak: Int
  let wilted: Bool
  let keptToday: Bool
}

struct Snapshot: Decodable {
  let updatedAt: Double
  let items: [SnapshotItem]
  let study: [StudyItem]
  let plant: PlantInfo

  /// Reads the newest snapshot from any App Group the widget can see. Sideloading tools rename the
  /// group when re-signing (e.g. AltStore appends the team ID), so the name in app.json may not be the real one.
  static func load() -> Snapshot? {
    var best: Snapshot?
    for group in candidateGroups() {
      guard
        let json = UserDefaults(suiteName: group)?.string(forKey: "snapshot"),
        let data = json.data(using: .utf8),
        let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data)
      else { continue }
      if best == nil || snapshot.updatedAt > best!.updatedAt { best = snapshot }
    }
    return best
  }

  /// Keep in step with appGroupCandidates in src/widget/app-group.ts.
  static func candidateGroups() -> [String] {
    // Take every granted group as-is: sideloaders don't agree on a naming scheme.
    var groups = groupsInProfile()
    let baseBundle = "com.jophy.todolist"
    if var appId = Bundle.main.bundleIdentifier {
      if appId.hasSuffix(".widget") { appId = String(appId.dropLast(".widget".count)) }
      if appId != baseBundle {
        if appId.hasPrefix(baseBundle + ".") { groups.append(appGroup + String(appId.dropFirst(baseBundle.count))) }
        groups.append("group." + appId)
      }
    }
    groups.append(appGroup)
    var seen = Set<String>()
    return groups.filter { seen.insert($0).inserted }
  }

  /// Shown instead of tasks when no snapshot is found, to make storage problems diagnosable.
  static var missingDataHint: String {
    let granted = groupsInProfile()
    return granted.isEmpty ? "No data: widget has no shared storage" : "No data yet in \(granted.joined(separator: ", "))"
  }

  /// App Groups granted by this extension's provisioning profile.
  static func groupsInProfile() -> [String] {
    guard
      let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
      let data = try? Data(contentsOf: url),
      let text = String(data: data, encoding: .isoLatin1),
      let keyRange = text.range(of: "<key>com.apple.security.application-groups</key>"),
      let arrayEnd = text.range(of: "</array>", range: keyRange.upperBound..<text.endIndex)
    else { return [] }
    let block = String(text[keyRange.upperBound..<arrayEnd.lowerBound])
    var result: [String] = []
    for part in block.components(separatedBy: "<string>").dropFirst() {
      if let end = part.range(of: "</string>") {
        let value = part[part.startIndex..<end.lowerBound].trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("group.") { result.append(value) }
      }
    }
    return result
  }

  static let sample = Snapshot(
    updatedAt: Date().timeIntervalSince1970 * 1000,
    items: [
      SnapshotItem(title: "Buy milk", dueAt: Date().addingTimeInterval(3600).timeIntervalSince1970 * 1000),
      SnapshotItem(title: "Gym", dueAt: Date().addingTimeInterval(7200).timeIntervalSince1970 * 1000),
    ],
    study: [StudyItem(name: "Biology", remaining: 1, behind: false)],
    plant: PlantInfo(streak: 5, wilted: false, keptToday: true)
  )
}

// MARK: - Timeline

struct DatedTask {
  let title: String
  let due: Date
}

struct ListRow {
  let title: String
  let due: Date?
}

struct TodoEntry: TimelineEntry {
  let date: Date
  let snapshot: Snapshot?

  private var calendar: Calendar { Calendar.current }
  private var endOfToday: Date { calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: date))! }

  /// Open tasks with a due date, soonest first.
  private var dated: [DatedTask] {
    let items = snapshot?.items ?? []
    var result: [DatedTask] = []
    for item in items {
      if let due = item.due { result.append(DatedTask(title: item.title, due: due)) }
    }
    return result.sorted { $0.due < $1.due }
  }

  var overdue: [DatedTask] { dated.filter { $0.due < date } }
  var dueToday: [DatedTask] { dated.filter { $0.due >= date && $0.due < endOfToday } }
  var upcoming: [DatedTask] { dated.filter { $0.due >= date } }
  var undated: [String] { (snapshot?.items ?? []).filter { $0.dueAt == nil }.map { $0.title } }

  /// Overdue first, then what's coming up, then tasks without a date.
  var list: [ListRow] {
    let dueRows = (overdue + upcoming).map { ListRow(title: $0.title, due: $0.due) }
    return dueRows + undated.map { ListRow(title: $0, due: nil) }
  }

  var streak: Int { snapshot?.plant.streak ?? 0 }
  var wilted: Bool { (snapshot?.plant.wilted ?? false) || !overdue.isEmpty }

  /// "Watered" only counts for the day the app last saw activity.
  var wateredToday: Bool {
    guard let s = snapshot, s.plant.keptToday else { return false }
    return calendar.isDate(Date(timeIntervalSince1970: s.updatedAt / 1000), inSameDayAs: date)
  }

  var studyBehind: [StudyItem] { (snapshot?.study ?? []).filter { $0.behind } }
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> TodoEntry {
    TodoEntry(date: Date(), snapshot: .sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (TodoEntry) -> Void) {
    completion(TodoEntry(date: Date(), snapshot: context.isPreview ? (Snapshot.load() ?? .sample) : Snapshot.load()))
  }

  /// One entry now, one at each upcoming due time (so tasks flip to "overdue" on their own),
  /// and one at midnight; the app also reloads the widget whenever its data changes.
  func getTimeline(in context: Context, completion: @escaping (Timeline<TodoEntry>) -> Void) {
    let now = Date()
    let snapshot = Snapshot.load()
    let calendar = Calendar.current
    let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
    let dueTimes: [Date] = (snapshot?.items ?? []).compactMap { $0.due }.filter { $0 > now && $0 < now.addingTimeInterval(86_400) }
    let dates: [Date] = Array(([now, midnight] + dueTimes).sorted().prefix(40))
    let entries: [TodoEntry] = dates.map { TodoEntry(date: $0, snapshot: snapshot) }
    completion(Timeline(entries: entries, policy: .after(midnight.addingTimeInterval(60))))
  }
}

// MARK: - Formatting

func timeLabel(_ due: Date, now: Date) -> String {
  let f = DateFormatter()
  f.setLocalizedDateFormatFromTemplate(Calendar.current.isDate(due, inSameDayAs: now) ? "jmm" : "EEEjmm")
  return f.string(from: due)
}

// MARK: - Views

struct PlantBadge: View {
  let entry: TodoEntry

  var body: some View {
    HStack(spacing: 2) {
      Image(systemName: entry.wilted ? "leaf.arrow.triangle.circlepath" : entry.wateredToday ? "leaf.fill" : "leaf")
      Text("\(entry.streak)")
    }
  }
}

struct RectangularView: View {
  let entry: TodoEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      HStack(spacing: 4) {
        if !entry.overdue.isEmpty {
          Image(systemName: "exclamationmark.circle.fill")
          Text("\(entry.overdue.count) overdue")
        } else {
          Image(systemName: "checklist")
          Text(entry.dueToday.isEmpty ? "Nothing due today" : "\(entry.dueToday.count) due today")
        }
        Spacer(minLength: 4)
        PlantBadge(entry: entry)
      }
      .font(.system(size: 13, weight: .semibold))
      .widgetAccentable()

      if entry.snapshot == nil {
        Text(Snapshot.missingDataHint).font(.system(size: 11)).lineLimit(2)
      } else if entry.list.isEmpty {
        Text(entry.wateredToday ? "All clear. Plant watered." : "Water your plant today").font(.system(size: 13))
      } else {
        ForEach(Array(entry.list.prefix(2).enumerated()), id: \.offset) { _, item in
          HStack(spacing: 4) {
            if let due = item.due {
              Text(timeLabel(due, now: entry.date)).fontWeight(.semibold)
            }
            Text(item.title)
          }
          .font(.system(size: 13))
          .lineLimit(1)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct CircularView: View {
  let entry: TodoEntry

  var body: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 0) {
        Image(systemName: entry.overdue.isEmpty ? "checklist" : "exclamationmark.circle.fill")
          .font(.system(size: 12, weight: .semibold))
        Text("\(entry.overdue.count + entry.dueToday.count)")
          .font(.system(size: 20, weight: .bold))
          .minimumScaleFactor(0.6)
      }
      .widgetAccentable()
    }
  }
}

struct InlineView: View {
  let entry: TodoEntry

  var body: some View {
    if let first = entry.overdue.first {
      Label("\(entry.overdue.count) overdue · \(first.title)", systemImage: "exclamationmark.circle")
    } else if let next = entry.upcoming.first {
      Label("\(timeLabel(next.due, now: entry.date)) \(next.title)", systemImage: "checklist")
    } else {
      Label("Nothing due · \(entry.streak)-day streak", systemImage: "leaf")
    }
  }
}

struct SmallView: View {
  let entry: TodoEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Text(entry.overdue.isEmpty ? "To-Do" : "\(entry.overdue.count) overdue")
          .font(.system(size: 15, weight: .bold))
          .foregroundStyle(entry.overdue.isEmpty ? Color.primary : Color.red)
        Spacer()
        PlantBadge(entry: entry)
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(entry.wilted ? Color.red : Color.green)
      }
      if entry.list.isEmpty {
        Spacer()
        Text(entry.snapshot == nil ? Snapshot.missingDataHint : "Nothing to do")
          .font(.system(size: 13))
          .foregroundStyle(.secondary)
        Spacer()
      } else {
        ForEach(Array(entry.list.prefix(4).enumerated()), id: \.offset) { _, item in
          VStack(alignment: .leading, spacing: 0) {
            Text(item.title).font(.system(size: 13, weight: .medium)).lineLimit(1)
            if let due = item.due {
              Text(timeLabel(due, now: entry.date))
                .font(.system(size: 11))
                .foregroundStyle(due < entry.date ? Color.red : Color.secondary)
            }
          }
        }
        Spacer(minLength: 0)
      }
      if let course = entry.studyBehind.first {
        Label("Study \(course.name)", systemImage: "graduationcap.fill")
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(.orange)
          .lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

struct TodoWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: TodoEntry

  var body: some View {
    switch family {
    case .accessoryRectangular:
      RectangularView(entry: entry).containerBackground(for: .widget) { Color.clear }
    case .accessoryCircular:
      CircularView(entry: entry).containerBackground(for: .widget) { Color.clear }
    case .accessoryInline:
      InlineView(entry: entry).containerBackground(for: .widget) { Color.clear }
    default:
      SmallView(entry: entry).containerBackground(for: .widget) { Color("$widgetBackground") }
    }
  }
}

// MARK: - Widget

struct TodoWidget: Widget {
  let kind = "TodoWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      TodoWidgetView(entry: entry).widgetURL(URL(string: "todolist://"))
    }
    .configurationDisplayName("To-Do")
    .description("Your next tasks, overdue count and plant streak.")
    .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline, .systemSmall])
  }
}

@main
struct TodoWidgetBundle: WidgetBundle {
  var body: some Widget {
    TodoWidget()
  }
}
