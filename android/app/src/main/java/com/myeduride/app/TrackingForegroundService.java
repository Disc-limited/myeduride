package com.myeduride.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class TrackingForegroundService extends Service implements LocationListener {

    private static final String TAG = "MyEduRideTracker";
    public static final String CHANNEL_ID = "myeduride_tracking_channel";
    public static final int NOTIFICATION_ID = 90210;

    public static final String ACTION_START = "com.myeduride.app.action.START_TRACKING";
    public static final String ACTION_STOP = "com.myeduride.app.action.STOP_TRACKING";
    public static final String ACTION_UPDATE = "com.myeduride.app.action.UPDATE_NOTIFICATION";

    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_TEXT = "extra_text";
    public static final String EXTRA_SUBTEXT = "extra_subtext";

    private static boolean isServiceRunning = false;
    private PowerManager.WakeLock wakeLock;
    private LocationManager locationManager;
    private NotificationManager notificationManager;

    private String currentTitle = "MyEduRide Transit Service";
    private String currentText = "Live GPS telemetry & student safety route active";
    private String currentSubText = "Real-time Vehicle Tracking";
    private long lastNotificationUpdate = 0;

    public static boolean isRunning() {
        return isServiceRunning;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "TrackingForegroundService created");
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();

        // Acquire WakeLock to maintain CPU execution during transit navigation
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MyEduRide:TrackingWakeLock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(12 * 60 * 60 * 1000L); // 12h safety ceiling
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to acquire wake lock", e);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            return START_STICKY;
        }

        String action = intent.getAction();
        Log.i(TAG, "onStartCommand received action: " + action);

        if (ACTION_STOP.equals(action)) {
            stopTracking();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (intent.hasExtra(EXTRA_TITLE)) {
            currentTitle = intent.getStringExtra(EXTRA_TITLE);
        }
        if (intent.hasExtra(EXTRA_TEXT)) {
            currentText = intent.getStringExtra(EXTRA_TEXT);
        }
        if (intent.hasExtra(EXTRA_SUBTEXT)) {
            currentSubText = intent.getStringExtra(EXTRA_SUBTEXT);
        }

        if (ACTION_UPDATE.equals(action)) {
            updateNotification(currentText);
            return START_STICKY;
        }

        // START TRACKING
        Notification notification = buildNotification(currentTitle, currentText, currentSubText);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            isServiceRunning = true;
            startLocationUpdates();
        } catch (Exception e) {
            Log.e(TAG, "Error starting foreground service: " + e.getMessage(), e);
            stopSelf();
            return START_NOT_STICKY;
        }

        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "MyEduRide Transit Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows persistent status when student transit tracking is active");
            channel.enableVibration(false);
            channel.setShowBadge(false);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String title, String text, String subText) {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSubText(subText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();
    }

    private void updateNotification(String updatedText) {
        if (!isServiceRunning || notificationManager == null) return;
        Notification notification = buildNotification(currentTitle, updatedText, currentSubText);
        notificationManager.notify(NOTIFICATION_ID, notification);
    }

    private void startLocationUpdates() {
        try {
            locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (locationManager == null) {
                Log.e(TAG, "LocationManager unavailable");
                return;
            }

            boolean isGpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
            boolean isNetworkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);

            Log.i(TAG, "GPS enabled: " + isGpsEnabled + ", Network enabled: " + isNetworkEnabled);

            // High accuracy GPS provider: request every 2000ms or 1 meter
            if (isGpsEnabled) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    2000L,
                    1.0f,
                    this
                );
            }

            // Fallback / fast initial fix from Network provider
            if (isNetworkEnabled) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    3000L,
                    2.0f,
                    this
                );
            }

            // Immediately check last known location if available
            Location lastGps = isGpsEnabled ? locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER) : null;
            Location lastNetwork = isNetworkEnabled ? locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER) : null;
            Location bestInitial = (lastGps != null) ? lastGps : lastNetwork;
            if (bestInitial != null) {
                onLocationChanged(bestInitial);
            }
        } catch (SecurityException se) {
            Log.e(TAG, "Location permission missing when starting updates", se);
        } catch (Exception e) {
            Log.e(TAG, "Failed to register location updates", e);
        }
    }

    private void stopTracking() {
        Log.i(TAG, "Stopping tracking service");
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(this);
            } catch (Exception e) {
                Log.e(TAG, "Error removing location listener", e);
            }
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception e) {
                Log.e(TAG, "Error releasing wake lock", e);
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        isServiceRunning = false;
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null) return;

        // Forward to Capacitor plugin
        ForegroundTrackingPlugin.dispatchLocation(location);

        // Throttle dynamic notification update to once every 10 seconds
        long now = System.currentTimeMillis();
        if (now - lastNotificationUpdate > 10000) {
            lastNotificationUpdate = now;
            float speedKmh = location.hasSpeed() ? location.getSpeed() * 3.6f : 0f;
            int accuracy = Math.round(location.getAccuracy());
            String text = String.format("Speed: %.0f km/h • Accuracy: ±%dm • GPS Active", speedKmh, accuracy);
            updateNotification(text);
        }
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public void onProviderEnabled(String provider) {
        Log.i(TAG, "Location provider enabled: " + provider);
    }

    @Override
    public void onProviderDisabled(String provider) {
        Log.w(TAG, "Location provider disabled: " + provider);
    }

    @Override
    public void onDestroy() {
        stopTracking();
        Log.i(TAG, "TrackingForegroundService destroyed");
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
