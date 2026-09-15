import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(LiveActivityPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.scrollView.bounces = false
        webView?.isOpaque = false
        webView?.backgroundColor = UIColor(red: 14/255, green: 15/255, blue: 18/255, alpha: 1.0)
    }
}
