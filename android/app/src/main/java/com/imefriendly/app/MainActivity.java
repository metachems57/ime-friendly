package com.imefriendly.app;

import android.os.Bundle;
import java.util.Locale;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String OPENING_URL = "https://localhost/ouverture.html?fromApp=1";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (savedInstanceState == null && bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().post(() -> {
                if (bridge != null && bridge.getWebView() != null) {
                    bridge.getWebView().loadUrl(OPENING_URL);
                }
            });
        }

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
                        bridge.getWebView().loadUrl(OPENING_URL);
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
