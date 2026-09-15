import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(LiveActivityPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 17/255, green: 18/255, blue: 20/255, alpha: 1.0)
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.scrollView.bounces = false
        webView?.isOpaque = false
        webView?.backgroundColor = UIColor(red: 17/255, green: 18/255, blue: 20/255, alpha: 1.0)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        webView?.frame = view.bounds
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
    }
}
