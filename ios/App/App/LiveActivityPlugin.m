#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(LiveActivityPlugin, "LiveActivityPlugin",
    CAP_PLUGIN_METHOD(startActivity, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updateActivity, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopActivity, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getActiveTask, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(syncTasks, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(syncStandby, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(syncSleepMode, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(checkAuthorization, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(openSettings, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setWidgetAuth, CAPPluginReturnPromise);
)
