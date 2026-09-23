import XCTest
final class SculptAIUITests: XCTestCase {
    @MainActor func testMainNavigationAndAccountConnection() {
        let app = XCUIApplication(); app.launchArguments = ["--ui-testing"]; app.launch()
        XCTAssertTrue(app.navigationBars["Studio"].waitForExistence(timeout: 10))
        let connectButton = app.buttons["Connect your SculptAI account"]
        XCTAssertTrue(connectButton.exists)
        XCTAssertGreaterThanOrEqual(connectButton.frame.minX, 0)
        XCTAssertLessThanOrEqual(connectButton.frame.maxX, app.frame.width)
        for name in ["Training", "Fuel", "Insights", "Coach", "Studio"] {
            app.tabBars.buttons[name].tap()
            XCTAssertTrue(app.navigationBars[name == "Coach" ? "AI Coach" : name].exists)
        }
        app.buttons["account"].tap()
        XCTAssertTrue(app.navigationBars["Your account"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["Get my connection code"].exists)
        app.buttons["Get my connection code"].tap()
        XCTAssertTrue(app.buttons["I approved this iPhone"].waitForExistence(timeout: 30))
        app.buttons["I approved this iPhone"].tap()
        XCTAssertTrue(app.staticTexts["Waiting for approval. Enter this code on the SculptAI website first."].waitForExistence(timeout: 15))
        let account = XCTAttachment(screenshot: app.screenshot())
        account.name = "Account pairing awaiting approval"; account.lifetime = .keepAlways; add(account)
        app.buttons["Done"].tap()
        let studio = XCTAttachment(screenshot: app.screenshot())
        studio.name = "Studio"; studio.lifetime = .keepAlways; add(studio)
    }
}
