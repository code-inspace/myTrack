import UIKit
import Capacitor

class ViewController: CAPBridgeViewController, UIScrollViewDelegate {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(LiveActivityPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 17/255, green: 18/255, blue: 20/255, alpha: 1.0)
        
        if let sv = webView?.scrollView {
            sv.contentInsetAdjustmentBehavior = .never
            sv.isScrollEnabled = false
            sv.bounces = false
            sv.alwaysBounceVertical = false
            sv.alwaysBounceHorizontal = false
            sv.contentInset = .zero
            sv.delegate = self
        }
        webView?.isOpaque = false
        webView?.backgroundColor = UIColor(red: 17/255, green: 18/255, blue: 20/255, alpha: 1.0)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        webView?.frame = view.bounds
        if let sv = webView?.scrollView {
            sv.contentInsetAdjustmentBehavior = .never
            sv.contentInset = .zero
            if sv.contentOffset != .zero {
                sv.contentOffset = .zero
            }
        }
    }

    // Lock native WKWebView scrollView permanently to prevent viewport shift
    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        if scrollView.contentOffset != .zero {
            scrollView.contentOffset = .zero
        }
    }
}
