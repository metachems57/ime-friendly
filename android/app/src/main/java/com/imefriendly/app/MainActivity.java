package com.imefriendly.app;

import android.os.Bundle;
import java.util.Locale;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (bridge != null && bridge.getWebView() != null) {
                    if (bridge.getWebView().canGoBack()) {
                        bridge.getWebView().goBack();
                        return;
                    }

                    final String currentUrl = bridge.getWebView().getUrl();
                    if (currentUrl != null && !isRootPage(currentUrl)) {
                        bridge.getWebView().loadUrl("file:///android_asset/public/ouverture.html?fromApp=1");
                        return;
                    }
                }

                moveTaskToBack(true);
            }
        });
    }

    private boolean isRootPage(String url) {
        String normalized = url.toLowerCase(Locale.ROOT);
        return normalized.contains("/ouverture.html")
            || normalized.endsWith("/index.html")
            || normalized.contains("/index.html?")
            || normalized.equals("capacitor://localhost")
            || normalized.equals("capacitor://localhost/");
    }
}
