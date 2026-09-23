import XCTest
final class SculptAIUITests: XCTestCase {
    @MainActor func testMainNavigationAndAccountConnection() {
        let app = XCUIApplication(); app.launchArguments = ["--ui-testing"]; app.launch()
        XCTAssertTrue(app.navigationBars["Studio"].waitForExistence(timeout: 10))
        for name in ["Training", "Fuel", "Insights", "Coach", "Studio"] {
            app.tabBars.buttons[name].tap()
            XCTAssertTrue(app.navigationBars[name == "Coach" ? "AI Coach" : name].exists)
        }
        app.buttons["account"].tap()
        XCTAssertTrue(app.navigationBars["Your account"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["Get my connection code"].exists)
        app.buttons["Done"].tap()
    }
}
