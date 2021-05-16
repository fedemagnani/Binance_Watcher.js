# Binance_Watcher.js
A simple script that allows you to download historical price data from all pairs against BUSD, USDT, BTC, BNB, ETH and to apply simple statistics on it.
This program requires NodeJS to be installed: https://nodejs.org/it/download/ 

If you want to add other timeframes, just populate the array called "timeframes" at the top of main.js script
If you want to change the quote assets, just edit the array called "quoteList" at the top of  main.js script

STEPS:

0) Open your terminal (Start > cmd)

1) `git clone https://github.com/fedemagnani/Binance_Watcher.js.git`

2) `cd Binance_Watcher.js`

3) `npm install` (in order to install all the dependencies)

4) `node main`

This will allow you to download the last 1000 candles of each timeframe you've set (by default: "5m","30m","1h","4h","1d","1w") of ANY PAIR against the quote assets you've set (by default: "BUSD","USDT","BTC","ETH","BNB"). For example, you can check the daily USDT candles by going to `/Candele_USDT/1d/` and then select the pair you want.

For what regards asset allocation, the script will calculate weights for:

☼ Optimal Risky Portfolio

☼ Minimum Variance Portfolio

You just have to set the number of candles required for each pair in order to be considered in the calculation of the portfolios: you can do it by changing  the `requiredCandles` variable in `main.js` 

By default, this script will compute the optimal portfolio built on any timeframe you've specified and on any pair related to the quote assets you've set. You can check the optimal portfolio weights, expected return, standard deviation and sharpe ratio by going to `/Portafogli_Ottimi/timeframe/example.json`

In addition, if you go to `/Statistica_Descrittiva_UnicaSerie_1d/` you can check the file that summarizes some statistics computed on the daily candles of each USDT pair, The statistics included are:

• Expected Return

• Variance

• Standard Deviation

• Sharpe Ratio

• Value at risk (fifth percentile)

• Ninety-fifth percentile

• Skewness

• Kurtosis