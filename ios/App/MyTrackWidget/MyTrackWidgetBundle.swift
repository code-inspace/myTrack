//
//  MyTrackWidgetBundle.swift
//  MyTrackWidget
//
//  Created by Axel on 03/09/2026.
//

import WidgetKit
import SwiftUI

@main
struct MyTrackWidgetBundle: WidgetBundle {
    var body: some Widget {
        MyTrackWidget()
        MyTrackWidgetLiveActivity()
    }
}
