package com.minhatv.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);  // tela não apaga

        web = new WebView(this);
        web.setBackgroundColor(0xFF000000);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                       // favoritos e últimos canais
        s.setDatabaseEnabled(true);                         // guardar a lista de canais (IndexedDB)
        s.setMediaPlaybackRequiresUserGesture(false);       // o vídeo toca sem precisar de toque
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);   // libera links http
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);        // sem bloqueio de CORS

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    // Botões CH+ / CH- do controle viram PageUp / PageDown dentro da página
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getAction() == KeyEvent.ACTION_DOWN) {
            int k = e.getKeyCode();
            if (k == KeyEvent.KEYCODE_CHANNEL_UP)   { tecla("PageUp");   return true; }
            if (k == KeyEvent.KEYCODE_CHANNEL_DOWN) { tecla("PageDown"); return true; }
        }
        return super.dispatchKeyEvent(e);
    }

    private void tecla(String nome) {
        web.evaluateJavascript(
            "document.dispatchEvent(new KeyboardEvent('keydown',{key:'" + nome + "',bubbles:true}))", null);
    }

    // Voltar: se o guia de canais está aberto, fecha o guia. Senão, sai do app.
    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
            "(function(){try{if(typeof menuAberto!=='undefined'&&menuAberto){"
            + "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return 'ficar';}"
            + "}catch(e){}return 'sair';})()",
            valor -> { if (valor == null || valor.contains("sair")) finish(); });
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
