import React from 'react';
import { WebView } from 'react-native-webview';

function PaynimoCheckoutWebView() {
  const htmlContent = `
    <!doctype html>
    <html>
    <head>
      <title>Checkout Demo</title>
      <meta name="viewport" content="user-scalable=no, width=device-width, initial-scale=1" />
      <script src="https://www.paynimo.com/paynimocheckout/client/lib/jquery.min.js" type="text/javascript" onload="console.log('jQuery loaded')" onerror="console.error('jQuery failed to load')"></script>
    </head>
    <body>
      <button id="btnSubmit">Proceed to Pay</button>
      <script src="https://www.paynimo.com/paynimocheckout/server/lib/checkout.js" type="text/javascript" onload="console.log('checkout.js loaded')" onerror="console.error('checkout.js failed to load')"></script>
      <script type="text/javascript">
        console.log("WebView JavaScript started executing.");
        $(document).ready(function() {
          console.log("jQuery ready. $: ", typeof $, " jQuery: ", typeof jQuery);
          $("#btnSubmit").on("click", function(e) {
            console.log("Button clicked!");
            e.preventDefault();
            var reqJson = ${JSON.stringify({
              features: {
                enableAbortResponse: true,
                enableExpressPay: true,
                enableInstrumentDeRegistration: true,
                enableMerTxnDetails: true,
                enableNewWindowFlow: false, // Disable for now
              },
              consumerData: {
                deviceId: "WEBSH2",
                token: "dce6c8bb6d0f6da21a86fccb8ce8df913fe386228875b0f43c2384d0c64293e9c623c95faaea2d03bf0b1314f7530b63e6e8bcfed71c6419df95e137695f9be0",
                returnUrl: "https://pgproxyuat.in.worldline-solutions.com/linuxsimulator/MerchantResponsePage.jsp",
                paymentMode: "all",
                merchantLogoUrl: "https://www.paynimo.com/CompanyDocs/company-logo-vertical.png",
                merchantId: "T1071800",
                currency: "INR",
                consumerId: "c964634",
                txnId: "TXNo1tr2uyyw1",
                items: [{ itemId: "first", amount: "1", comAmt: "0" }],
                customStyle: {
                  PRIMARY_COLOR_CODE: "#45beaa",
                  SECONDARY_COLOR_CODE: "#FFFFFF",
                  BUTTON_COLOR_CODE_1: "#2d8c8c",
                  BUTTON_COLOR_CODE_2: "#FFFFFF",
                },
              },
            })};
            reqJson.consumerData.responseHandler = function(res) {
              console.log("Response:", JSON.stringify(res));
              window.ReactNativeWebView.postMessage(JSON.stringify(res));
            };
            console.log("Calling $.pnCheckout with:", reqJson);
            if (window.$.pnCheckout) {
              window.$.pnCheckout(reqJson);
            } else {
              console.error("$.pnCheckout not found!");
            }
          });
        });
      </script>
    </body>
    </html>
  `;

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html: htmlContent }}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      allowUniversalAccessFromFileURLs={true}
      allowFileAccess={true}
      onMessage={(event) => {
        console.log("WebView Message:", event.nativeEvent.data);
      }}
      onError={(syntheticEvent) => {
        console.warn("WebView Error:", syntheticEvent.nativeEvent);
      }}
      injectedJavaScript={`
        console.log = function(...args) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', data: args }));
        };
        console.error = function(...args) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', data: args }));
        };
      `}
    />
  );
}

export default PaynimoCheckoutWebView;