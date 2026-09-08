package com.myeduride.app;

import android.Manifest;
import android.content.Intent;
import android.location.Location;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "ForegroundTracking",
    permissions = {
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }
        ),
        @Permission(
            alias = "notifications",
            strings = {
                Manifest.permission.POST_NOTIFICATIONS
            }
        )
    }
)
public class ForegroundTrackingPlugin extends Plugin {

    private static ForegroundTrackingPlugin activeInstance;

    @Override
    public void load() {
        super.load();
        activeInstance = this;
    }

    public static void dispatchLocation(Location location) {
        if (activeInstance != null) {
            activeInstance.sendLocationUpdate(location);
        }
    }

    private void sendLocationUpdate(Location location) {
        JSObject data = new JSObject();
        data.put("latitude", location.getLatitude());
        data.put("longitude", location.getLongitude());
        data.put("accuracy", location.getAccuracy());
        data.put("speed", location.hasSpeed() ? location.getSpeed() : 0.0);
        data.put("speedKmh", location.hasSpeed() ? Math.round(location.getSpeed() * 3.6f * 10.0f) / 10.0f : 0.0);
        data.put("heading", location.hasBearing() ? Math.round(location.getBearing()) : 0);
        if (location.hasAltitude()) {
            data.put("altitude", location.getAltitude());
        }
        data.put("timestamp", location.getTime());

        notifyListeners("locationUpdate", data);
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermsCallback");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermsCallback");
            return;
        }

        doStartService(call);
    }

    @PermissionCallback
    private void locationPermsCallback(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED) {
                requestPermissionForAlias("notifications", call, "notificationPermsCallback");
                return;
            }
            doStartService(call);
        } else {
            call.reject("Location permission is required for transit tracking");
        }
    }

    @PermissionCallback
    private void notificationPermsCallback(PluginCall call) {
        // Proceed even if notification permission is denied; service will still run
        doStartService(call);
    }

    private void doStartService(PluginCall call) {
        String title = call.getString("title", "MyEduRide Transit Service");
        String text = call.getString("text", "Live GPS telemetry & student safety route active");
        String subText = call.getString("subText", "Real-time Vehicle Tracking");

        Intent intent = new Intent(getContext(), TrackingForegroundService.class);
        intent.setAction(TrackingForegroundService.ACTION_START);
        intent.putExtra(TrackingForegroundService.EXTRA_TITLE, title);
        intent.putExtra(TrackingForegroundService.EXTRA_TEXT, text);
        intent.putExtra(TrackingForegroundService.EXTRA_SUBTEXT, subText);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("status", "started");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to start foreground service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), TrackingForegroundService.class);
            intent.setAction(TrackingForegroundService.ACTION_STOP);
            getContext().startService(intent);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("status", "stopped");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to stop tracking: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void isTracking(PluginCall call) {
        JSObject result = new JSObject();
        result.put("active", TrackingForegroundService.isRunning());
        call.resolve(result);
    }

    @PluginMethod
    public void updateNotification(PluginCall call) {
        String text = call.getString("text");
        if (text != null && !text.isEmpty()) {
            Intent intent = new Intent(getContext(), TrackingForegroundService.class);
            intent.setAction(TrackingForegroundService.ACTION_UPDATE);
            intent.putExtra(TrackingForegroundService.EXTRA_TEXT, text);
            try {
                getContext().startService(intent);
            } catch (Exception ignored) {}
        }
        call.resolve();
    }
}
