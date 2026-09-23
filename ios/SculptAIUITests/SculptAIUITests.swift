import XCTest
final class SculptAIUITests: XCTestCase {
    @MainActor func testStudioDateAndAccountStatusStayVisibleDuringScrolling() {
        let app = XCUIApplication(); app.launchArguments = ["--ui-testing"]; app.launch()
        let date = app.staticTexts["studio.date"]
        let accountButton = app.buttons["account"]
        XCTAssertTrue(date.waitForExistence(timeout: 10))
        for index in 0..<3 {
            app.swipeUp()
            XCTAssertTrue(date.isHittable)
            XCTAssertTrue(accountButton.isHittable)
            if index == 0 {
                let capture = XCTAttachment(screenshot: app.screenshot())
                capture.name = "Studio with fixed date and account row after scrolling"
                capture.lifetime = .keepAlways
                add(capture)
            }
            app.swipeDown()
            XCTAssertTrue(date.isHittable)
            XCTAssertTrue(accountButton.isHittable)
        }
    }
    @MainActor func testMainNavigationAndAccountConnection() {
        let app = XCUIApplication(); app.launchArguments = ["--ui-testing"]; app.launch()
        XCTAssertTrue(app.navigationBars["Studio"].waitForExistence(timeout: 10))
        let connectButton = app.buttons["Create account or sign in"]
        XCTAssertTrue(connectButton.exists)
        XCTAssertGreaterThanOrEqual(connectButton.frame.minX, 0)
        XCTAssertLessThanOrEqual(connectButton.frame.maxX, app.frame.width)
        for name in ["Training", "Fuel", "Insights", "Coach", "Studio"] {
            app.tabBars.buttons[name].tap()
            XCTAssertTrue(app.navigationBars[name == "Coach" ? "AI Coach" : name].exists)
            app.swipeUp()
            app.swipeDown()
            XCTAssertTrue(app.navigationBars[name == "Coach" ? "AI Coach" : name].exists)
            XCTAssertTrue(app.tabBars.buttons[name].exists)
            XCTAssertFalse(app.staticTexts["Working…"].exists)
        }
        app.buttons["account"].tap()
        XCTAssertTrue(app.navigationBars["Your account"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["Create account"].exists)
        XCTAssertTrue(app.buttons["Sign in to existing account"].exists)
        app.buttons["Connect using a code instead"].tap()
        XCTAssertTrue(app.buttons["Get my connection code"].exists)
        app.buttons["Get my connection code"].tap()
        let code = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Pairing code ")).firstMatch
        XCTAssertTrue(code.waitForExistence(timeout: 30))
        app.swipeUp()
        XCTAssertTrue(app.buttons["I approved this iPhone"].waitForExistence(timeout: 5))
        app.buttons["I approved this iPhone"].tap()
        XCTAssertTrue(app.staticTexts["Waiting for approval. Enter this code on the SculptAI website first."].waitForExistence(timeout: 15))
        let account = XCTAttachment(screenshot: app.screenshot())
        account.name = "Account pairing awaiting approval"; account.lifetime = .keepAlways; add(account)
        app.buttons["Done"].tap()
        let studio = XCTAttachment(screenshot: app.screenshot())
        studio.name = "Studio"; studio.lifetime = .keepAlways; add(studio)
    }
}
