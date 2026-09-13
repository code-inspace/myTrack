import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        if let url = launchOptions?[.url] as? URL {
            notifyWebviewUrl(url: url, delay: 1.0)
        }
        return true
    }

    private func notifyWebviewUrl(url: URL, delay: Double = 0.3) {
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            if let rootVC = self.window?.rootViewController as? CAPBridgeViewController,
               let webView = rootVC.webView {
                let escapedUrl = url.absoluteString.replacingOccurrences(of: "'", with: "\\'")
                let js = """
                window.dispatchEvent(new CustomEvent('appUrlOpen', { detail: { url: '\(escapedUrl)' } }));
                window.dispatchEvent(new CustomEvent('mytrack:open-url', { detail: { url: '\(escapedUrl)' } }));
                """
                webView.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        let handled = ApplicationDelegateProxy.shared.application(app, open: url, options: options)
        notifyWebviewUrl(url: url, delay: 0.15)
        return handled
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        if let url = userActivity.webpageURL {
            notifyWebviewUrl(url: url, delay: 0.15)
        }
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
