const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

export function loadRazorpayCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${RAZORPAY_SCRIPT_URL}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener(
        "load",
        () => {
          if (window.Razorpay) {
            resolve(true);
          } else {
            reject(new Error("Razorpay Checkout failed to initialize."));
          }
        },
        { once: true },
      );

      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Razorpay Checkout.")),
        { once: true },
      );

      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;

    script.onload = () => {
      if (window.Razorpay) {
        resolve(true);
      } else {
        reject(new Error("Razorpay Checkout failed to initialize."));
      }
    };

    script.onerror = () => {
      reject(new Error("Failed to load Razorpay Checkout."));
    };

    document.body.appendChild(script);
  });
}
