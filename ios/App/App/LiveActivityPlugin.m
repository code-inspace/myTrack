#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(LiveActivityPlugin, "LiveActivityPlugin",
    CAP_PLUGIN_METHOD(startActivity, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updateActivity, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopActivity, CAPPluginReturnPromise);
)
