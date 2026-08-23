import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:smartrailos_app/app.dart';

void main() {
  testWidgets('MetroApp smoke test', (WidgetTester tester) async {
    // Build our app with ProviderScope and trigger a frame.
    await tester.pumpWidget(const ProviderScope(child: MetroApp()));
    await tester.pump(const Duration(milliseconds: 500));

    // Verify that the title / top header is rendered
    expect(find.text('SMARTRAIL OS'), findsOneWidget);
  });
}
