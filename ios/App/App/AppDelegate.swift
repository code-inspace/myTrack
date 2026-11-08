import UIKit
import Capacitor

/// Dispatches an incoming URL (deep link / universal link) to the Capacitor webview.
func notifyWebviewUrl(window: UIWindow?, url: URL, delay: Double = 0.3) {
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
        if let rootVC = window?.rootViewController as? CAPBridgeViewController,
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

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        // Main storyboard is not auto-instantiated for scenes unless UISceneStoryboardFile is set; this keeps it explicit.
        if window == nil {
            let w = UIWindow(windowScene: windowScene)
            w.rootViewController = UIStoryboard(name: "Main", bundle: nil).instantiateInitialViewController()
            window = w
        }
        window?.backgroundColor = UIColor(red: 17/255, green: 18/255, blue: 20/255, alpha: 1.0)
        window?.makeKeyAndVisible()

        if let url = connectionOptions.urlContexts.first?.url {
            notifyWebviewUrl(window: window, url: url, delay: 1.0)
        } else if let url = connectionOptions.userActivities.first?.webpageURL {
            notifyWebviewUrl(window: window, url: url, delay: 1.0)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
        notifyWebviewUrl(window: window, url: url, delay: 0.1)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        if let url = userActivity.webpageURL {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
            notifyWebviewUrl(window: window, url: url, delay: 0.1)
        }
    }
}
