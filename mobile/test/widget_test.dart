import 'package:flutter_test/flutter_test.dart';
import 'package:group_formation/main.dart';

void main() {
  testWidgets('App smoke test — renders without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(const GroupFormationApp());
    expect(find.byType(GroupFormationApp), findsOneWidget);
  });
}
