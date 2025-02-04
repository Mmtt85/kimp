let counter = 15;
const updateTimer = () => {
  const remain_times = document.querySelector("#remain_times");
  remain_times.innerText = counter;
  if (counter === 0) {
    get();
    counter = document.getElementById("timer").value;
  }
  counter--;
};

setInterval(updateTimer, 1000);

const closeAlert = () => {
  const alertModal = document.querySelector("#alert-modal");
  alertModal.style.display = "none";
};

const showAlert = (message) => {
  const alertModal = document.querySelector("#alert-modal");
  const alertMessage = document.querySelector("#alert-message");
  alertMessage.innerText = message;
  alertModal.style.display = "block";
  setTimeout(() => {
    if (alertModal.style.display !== "none") {
      alertModal.style.display = "none";
      if (alertQueue.length > 0) {
        showAlert(alertQueue.shift());
      }
    }
  }, 3000);
};

const alertQueue = [];

const handleError = (error) => {
  alertQueue.push(error.message);
  if (alertQueue.length === 1) {
    showAlert(alertQueue.shift());
  }
};

const getBbXrpPrice = async () => {
  try {
    const response = await fetch("https://public.bitbank.cc/xrp_jpy/ticker");
    const jsonData = await response.json();
    return _.get(jsonData, "data.last");
  } catch (error) {
    handleError(error);
  }
};

const getBbSolanaPrice = async () => {
  try {
    const response = await fetch("https://public.bitbank.cc/sol_jpy/ticker");
    const jsonData = await response.json();
    return _.get(jsonData, "data.last");
  } catch (error) {
    handleError(error);
  }
};

const getBbBtcPrice = async () => {
  try {
    const response = await fetch("https://public.bitbank.cc/btc_jpy/ticker");
    const jsonData = await response.json();
    return _.get(jsonData, "data.last");
  } catch (error) {
    handleError(error);
  }
};

const getUpbitPrice = async () => {
  try {
    const response = await fetch(
      "https://api.upbit.com/v1/ticker?markets=KRW-XRP&markets=KRW-SOL&markets=KRW-BTC"
    );
    const jsonData = await response.json();
    return [
      _.get(jsonData, "0.trade_price"),
      _.get(jsonData, "1.trade_price"),
      _.get(jsonData, "2.trade_price"),
    ];
  } catch (error) {
    handleError(error);
  }
};

const getRate = async () => {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/JPY");
    const jsonData = await response.json();
    const rateManual = document.querySelector("#rate_manual");
    const KRW = _.get(jsonData, "rates.KRW");
    rateManual.placeholder = `미입력시 ${KRW}로 계산`; // Set rate_auto as placeholder
    if (_.get(rateManual, "value")) {
      return parseFloat(rateManual.value);
    } else {
      return KRW;
    }
  } catch (error) {
    handleError(error);
  }
};

const getRateSite = async () => {
  try {
    const rateSite = document.querySelector("#rate_site");
    const iframe = document.querySelector("#iframe");
    if (_.get(rateSite, "value")) {
      iframe.src = rateSite.value;
    } else {
      iframe.src = "https://kr.investing.com/currencies/jpy-krw";
    }
  } catch (error) {
    handleError(error);
  }
};

const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const get = async () => {
  const [bbXrp, bbSolana, bbBtc, upbitPrice, rate] = await Promise.all([
    getBbXrpPrice(),
    getBbSolanaPrice(),
    getBbBtcPrice(),
    getUpbitPrice(),
    getRate(),
  ]);

  const [upbitXrp, upbitSolana, upbitBtc] = upbitPrice;

  const updateTable = (bb, upbit, rate, bbId, upbitId, premiumId) => {
    const upbitYen = Math.floor(upbit / rate);
    const bbWon = Math.floor(bb * rate);
    const bbStr = `${formatNumber(Math.floor(bb))} ¥<br>(${formatNumber(
      bbWon
    )} ₩)`;
    const upbitStr = `${formatNumber(upbit)} ₩<br>(${formatNumber(
      upbitYen
    )} ¥)`;

    const premium = parseFloat(((upbitYen - bb) / bb) * 100).toFixed(2);
    const premiumStr = `${premium} %`;

    document.querySelector(premiumId).style.color = `rgb(${
      premium * 100 > 255 ? 255 : premium * 100
    }, 0, 0)`;
    document.querySelector(bbId).innerHTML = bbStr;
    document.querySelector(upbitId).innerHTML = upbitStr;
    document.querySelector(premiumId).innerText = premiumStr;
  };

  updateTable(bbXrp, upbitXrp, rate, "#bb_xrp", "#upbit_xrp", "#premium_xrp");
  updateTable(
    bbSolana,
    upbitSolana,
    rate,
    "#bb_solana",
    "#upbit_solana",
    "#premium_solana"
  );
  updateTable(bbBtc, upbitBtc, rate, "#bb_btc", "#upbit_btc", "#premium_btc");

  document.querySelector("title").innerText = `${
    document.querySelector("#premium_xrp").innerText
  }/${document.querySelector("#premium_solana").innerText}/${
    document.querySelector("#premium_btc").innerText
  }`;
  latest_refresh_datetime.innerText = new Date().toLocaleString();
};

const startCapture = async () => {
  const button = document.querySelector("#capture");
  button.textContent = "데이터 추출중...";
  button.disabled = true;

  try {
    // 화면을 공유하는 스트림을 요청
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    });

    // 스트림의 비디오 트랙을 가져옴
    const video = document.createElement("video");
    video.srcObject = stream;

    video.play();

    // 비디오가 로드된 후 캔버스에 그리기
    video.onloadedmetadata = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      _.forEach(stream.getTracks(), (track) => track.stop());

      const imgData = canvas.toDataURL("image/png");

      // base64 이미지 데이터를 Tesseract에 보내 텍스트 추출
      const result = await Tesseract.recognize(imgData, "eng");
      const text = _.get(result, "data.text");
      const split_text = _.split(text, /\n| /g);
      _.forEach(split_text, (t) => {
        const result = /^\d+\.\d{4}$/g.test(t);
        if (result) {
          document.querySelector("#rate_manual").value = t;
          return false;
        }
      });

      button.textContent = "캡쳐";
      button.disabled = false;
    };
  } catch (error) {
    button.textContent = "캡쳐";
    button.disabled = false;
  }
};

const refresh_iframe = () => {
  renderSiteDOM();
};

let autoRefreshInterval;

const refresh_iframe_auto = () => {
  const rateAuto = document.querySelector("#rate_auto");
  const autoRefreshButton = document.querySelector("#auto_refresh_button");
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
    autoRefreshButton.textContent = "자동갱신 설정";
    autoRefreshButton.style.backgroundColor = "#007bff";
    rateAuto.value = 0;
    rateAuto.disabled = false;
  } else if (rateAuto.value > 0) {
    autoRefreshInterval = setInterval(() => {
      refresh_iframe();
    }, rateAuto.value * 1000);
    autoRefreshButton.textContent = "자동갱신 설정완료";
    autoRefreshButton.style.backgroundColor = "#28a745";
    rateAuto.disabled = true;
  }
};

const calculateProfit = async () => {
  const spentMoney = parseFloat(
    document.querySelector("#spent_money").value.replace(/,/g, "")
  );
  const earnedMoney = parseFloat(
    document.querySelector("#earned_money").value.replace(/,/g, "")
  );
  const rateManual = document.querySelector("#rate_manual").value;
  const rate = rateManual ? parseFloat(rateManual) : await getRate(); // Use rate_manual if available

  if (!isNaN(spentMoney) && !isNaN(earnedMoney) && !isNaN(rate)) {
    const spentInWon = spentMoney * rate;
    const profitPercentage = ((earnedMoney - spentInWon) / spentInWon) * 100; // -2% for 송금수수료
    const profitInYen = Math.ceil(earnedMoney / rate - spentMoney);
    document.querySelector("#profit_percentage").innerText =
      profitPercentage.toFixed(2);
    document.querySelector("#profit_yen").innerText = formatNumber(
      Math.floor(profitInYen)
    );

    const finalProfitPercentage = profitPercentage - 1.5;
    const finalProfitInYen = Math.ceil(
      spentMoney * finalProfitPercentage * 0.01
    );
    document.querySelector("#final_profit_percentage").innerText =
      finalProfitPercentage.toFixed(2);
    document.querySelector("#final_profit_yen").innerText = formatNumber(
      Math.floor(finalProfitInYen)
    ); // Adjust profitInYen by -2%
  } else {
    document.querySelector("#profit_percentage").innerText = " - ";
    document.querySelector("#profit_yen").innerText = " - ";
  }
};

const renderSiteDOM = async () => {
  try {
    const response = await fetch("https://kr.investing.com/currencies/jpy-krw");
    const text = await response.text();
    const iframe = document.querySelector("#iframe");
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(text);
    iframeDoc.close();
  } catch (error) {
    handleError(error);
  }
};

const copyToClipboard = async (button) => {
  const divArea = button.parentElement;
  try {
    const canvas = await html2canvas(divArea, {
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll(".screenshot-button").forEach((btn) => {
          btn.style.display = "none";
        });
      },
      scrollX: 0,
      scrollY: -window.scrollY,
    });
    canvas.toBlob((blob) => {
      const item = new ClipboardItem({ "image/png": blob });
      navigator.clipboard.write([item]);
    });
    showAlert("클립보드에 복사되었습니다.");
  } catch (error) {
    handleError(error);
  }
};

renderSiteDOM();

getRate();
