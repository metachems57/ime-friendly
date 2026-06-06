package com.imefriendly.app;

import android.content.Intent;
import android.os.Bundle;
import java.util.Locale;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String OPENING_URL = "https://localhost/ouverture.html?fromApp=1";
    private static final String APP_BASE_URL = "https://localhost/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (savedInstanceState == null && bridge != null && bridge.getWebView() != null) {
            final String initialUrl = getNotificationTargetUrl(getIntent());
            bridge.getWebView().post(() -> {
                if (bridge != null && bridge.getWebView() != null) {
                    bridge.getWebView().loadUrl(initialUrl != null ? initialUrl : OPENING_URL);
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

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);

        final String targetUrl = getNotificationTargetUrl(intent);
        if (targetUrl == null || bridge == null || bridge.getWebView() == null) {
            return;
        }

        bridge.getWebView().post(() -> {
            if (bridge != null && bridge.getWebView() != null) {
                bridge.getWebView().loadUrl(targetUrl);
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

    private String getNotificationTargetUrl(Intent intent) {
        if (intent == null || intent.getExtras() == null || !intent.getExtras().containsKey("google.message_id")) {
            return null;
        }

        final Bundle extras = intent.getExtras();
        String link = cleanExtra(extras.get("link"));
        if (link.length() == 0) {
            link = buildLinkFromNotificationData(extras);
        }

        if (link.length() == 0) {
            return APP_BASE_URL + "index.html?fromApp=1";
        }

        return toAppUrl(link);
    }

    private String buildLinkFromNotificationData(Bundle extras) {
        final String source = cleanExtra(extras.get("source")).toLowerCase(Locale.ROOT);
        final String postId = firstNonEmpty(
            cleanExtra(extras.get("postId")),
            cleanExtra(extras.get("source_post_id"))
        );

        if (source.equals("messagerie")) {
            return "messagerie.html";
        }

        if (postId.length() == 0 || postId.equals("0")) {
            return "";
        }

        if (source.equals("reseau")) {
            return "reseau.html?highlightPost=" + postId + "#post-" + postId;
        }

        if (source.equals("blog")) {
            return "blog.html?highlightPost=" + postId + "#post-" + postId;
        }

        if (source.equals("tools") || source.equals("outils")) {
            return "detail-outil.html?id=" + postId;
        }

        return "";
    }

    private String toAppUrl(String link) {
        final String cleanLink = link.trim();
        final String lowerLink = cleanLink.toLowerCase(Locale.ROOT);
        if (lowerLink.startsWith("http://") || lowerLink.startsWith("https://")) {
            return cleanLink;
        }

        final String relativeLink = cleanLink.startsWith("/") ? cleanLink.substring(1) : cleanLink;
        return APP_BASE_URL + relativeLink;
    }

    private String cleanExtra(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String firstNonEmpty(String first, String second) {
        return first.length() > 0 ? first : second;
    }
}
