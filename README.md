# Binance_Watcher.js [![Scrutinizer Code Quality](https://scrutinizer-ci.com/g/fedemagnani/Binance_Watcher.js/badges/quality-score.png?b=main)](https://scrutinizer-ci.com/g/fedemagnani/Binance_Watcher.js/?branch=main) [![License](https://img.shields.io/badge/License-GPL--3.0-blue)](#license) [![stars - Binance_Watcher.js](https://img.shields.io/github/stars/fedemagnani/Binance_Watcher.js?style=social)](https://github.com/fedemagnani/Binance_Watcher.js/stargazers) [![Twitter](https://img.shields.io/twitter/url/https/twitter.com/nonsonouncoder.svg?style=social)](https://twitter.com/nonsonouncoder)
A simple script that allows you to download historical price data of all pairs against **BUSD**, **USDT**, **BTC**, **BNB**, **ETH** from Binance. This script allows you to get statistics from the price candles and to apply basic concepts of [Modern Portfolio Theory](https://en.wikipedia.org/wiki/Modern_portfolio_theory#:~:text=Modern%20portfolio%20theory%20(MPT)%2C,a%20given%20level%20of%20risk.&text=It%20uses%20the%20variance%20of%20asset%20prices%20as%20a%20proxy%20for%20risk.) by Harry Markowitz. 

Candles, portfolio weights and returns are also saved in CSV format.

## Getting started
This program requires NodeJS to be installed: https://nodejs.org/it/download/ 

STEPS:

0) Open your terminal (Start > cmd)

1) `git clone https://github.com/fedemagnani/Binance_Watcher.js.git`

2) `cd Binance_Watcher.js`

3) `npm install` (in order to install all the dependencies)

4) `node main`

If you want to add other timeframes, just populate the array called `timeframes` at the top of `main.js` script.
If you want to change the quote assets, just edit the array called `quoteList` at the top of  `main.js` script.

This will allow you to download the last 1000 candles of each timeframe you've set (by default: "5m","30m","1h","4h","1d","1w") of ANY PAIR against the quote assets you've set (by default: "BUSD","USDT","BTC","ETH","BNB"). For example, you can check the daily USDT candles by going to `/Candele_USDT/1d/` and then select the pair you want.

## Asset allocation
For what regards asset allocation, the script will calculate weights for:

☼ ***Efficient Frontier***

☼ ***Optimal Risky Portfolio***

☼ ***Minimum Variance Portfolio***

You just have to set the number of candles required for each pair in order to be considered in the calculation of the portfolios: you can do it by changing  the `requiredCandles` variable in `main.js` 

By default, this script will compute the optimal portfolio built on any timeframe you've specified and on any pair related to the quote assets you've set. You can check the optimal portfolio weights, expected return, standard deviation and sharpe ratio by going to `/Portafogli_Ottimi/timeframe/example.json`

![Frontier](https://github.com/fedemagnani/Binance_Watcher.js/blob/main/assets/efficientFrontierALT-BTC_weekly.png?raw=true)

## Statistics
In addition, if you go to `/Statistica_Descrittiva_UnicaSerie_1d/` you can check the file that summarizes some statistics computed on the daily candles of each USDT pair, The statistics included are:

• _Expected Return_

• _Variance_

• _Standard Deviation_

• _Sharpe Ratio_

• _Value at risk (fifth percentile)_

• _Ninety-fifth percentile_

• _Skewness_

• _Kurtosis_

• _Downside Risk_ (change variable `target` in `main.js`)