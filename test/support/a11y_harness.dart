import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

/// Shared helpers for inspecting the *rendered* semantics tree.
///
/// The finders in `flutter_test` answer "is there a node with this label?".
/// Accessibility defects in this codebase are almost always the opposite
/// question — "is there more than one?" — because the established pattern here
/// is a parent [Semantics] carrying a composed label over an [ExcludeSemantics]
/// subtree, and forgetting the exclusion makes a screen reader say everything
/// twice. These helpers therefore count and inspect nodes rather than merely
/// locating them.
///
/// Requires an active [WidgetTester.ensureSemantics] handle; without one the
/// tree is not built and every helper reports an empty tree.
List<SemanticsNode> semanticsNodes(WidgetTester tester) {
  // The root pipeline owner delegates rendering to a child owner per view, and
  // the semantics owner lives on that child — so the tree is searched rather
  // than read off the (deprecated) binding-level pipeline owner.
  SemanticsNode? root;
  void findOwner(PipelineOwner owner) {
    root ??= owner.semanticsOwner?.rootSemanticsNode;
    owner.visitChildren(findOwner);
  }

  findOwner(tester.binding.rootPipelineOwner);
  if (root == null) return const <SemanticsNode>[];
  final List<SemanticsNode> all = <SemanticsNode>[];
  void visit(SemanticsNode node) {
    all.add(node);
    node.visitChildren((SemanticsNode child) {
      visit(child);
      return true;
    });
  }

  visit(root!);
  return all;
}

/// The merged [SemanticsData] of every rendered node, in depth-first order.
///
/// A node that merges its descendants reports their text as its own and those
/// descendants are not separate nodes, so one entry here is exactly one thing a
/// screen reader can land on.
List<SemanticsData> semanticsDataList(WidgetTester tester) => semanticsNodes(
  tester,
).map((SemanticsNode node) => node.getSemanticsData()).toList();

/// How many times [text] is spoken across the whole rendered tree.
///
/// Counts occurrences *within* each label as well as across nodes, because a
/// duplicated announcement takes both forms: two sibling nodes each carrying
/// the text, and — the harder one to see — a single node whose label merged a
/// parent annotation with the identical visible text below it, producing
/// `"Offline\nOffline"` on one node. Counting nodes would call that one.
int labelOccurrences(WidgetTester tester, String text) {
  if (text.isEmpty) return 0;
  int total = 0;
  for (final SemanticsData data in semanticsDataList(tester)) {
    int from = data.label.indexOf(text);
    while (from >= 0) {
      total++;
      from = data.label.indexOf(text, from + text.length);
    }
  }
  return total;
}

/// Every rendered label, ignoring the nodes that carry none.
List<String> renderedLabels(WidgetTester tester) => semanticsDataList(tester)
    .map((SemanticsData data) => data.label)
    .where((String label) => label.isNotEmpty)
    .toList();

/// Every node flagged as a live region.
List<SemanticsData> liveRegions(WidgetTester tester) => semanticsDataList(
  tester,
).where((SemanticsData data) => data.flagsCollection.isLiveRegion).toList();

/// Every node flagged as a heading.
List<SemanticsData> headings(WidgetTester tester) => semanticsDataList(
  tester,
).where((SemanticsData data) => data.flagsCollection.isHeader).toList();

/// The single rendered node whose label is exactly [label].
///
/// Fails the test when there is none or more than one, so a caller inspecting
/// flags cannot silently inspect the wrong node.
SemanticsData nodeLabelled(WidgetTester tester, String label) {
  final List<SemanticsData> matches = semanticsDataList(
    tester,
  ).where((SemanticsData data) => data.label == label).toList();
  expect(
    matches,
    hasLength(1),
    reason:
        'expected exactly one node labelled "$label", '
        'found ${matches.length} in ${renderedLabels(tester)}',
  );
  return matches.single;
}
