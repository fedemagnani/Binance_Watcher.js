# Binance_Watcher.js
A simple script that allows you to download historical price data from all pairs against USDT, BTC, BNB, ETH and to apply simple statistics on it.
This program requires NodeJS to be installed: https://nodejs.org/it/download/ 

If you want to add other timeframes, just populate the array called "timeframes" at the bottom of BinanceWatcher.js script
If you want to change the quote assets, just edit the array called "quoteList" at the bottom of  BinanceWatcher.js script

STEPS:

0) Open your terminal (Start > cmd)

1) `git clone https://github.com/fedemagnani/Binance_Watcher.js.git`

2) `cd Binance_Watcher.js`

3) `npm install` (in order to install all the dependencies)

4) `node main`

This will allow you to download the last 1000 candles of each timeframe you've set (by default: "5m","30m","1h","4h","1d","1w") of ANY PAIR against the quote assets you've set (by default: "USDT","BTC","ETH","BNB"). For example, you can check the daily USDT candles by going to "/Candele_BTC/1d/" and then select the pair you want.

In addition, if you go to "Statistica_Descrittiva_UnicaSerie_1d" you can check the file that summarizes some statistics computed on the daily candles of each USDT pair, The statistics included are:

• Expected Return

• Variance

• Standard Deviation

• Sharpe Ratio

• Value at risk (fifth percentile)

• Ninety-fifth percentile

• Skewness

• Kurtosis
