//Aggiornando tutte le candele dovrai rimuovere dalle cartelle le coppie delistate da Binance
var request = require('request');
const path=require('path')
const fs = require('fs');
const _ =require('lodash');
var ss = require('simple-statistics');
const PortfolioAllocation = require('portfolio-allocation');
const { json } = require('express');
const { resolve, parse } = require('path');

class BinanceWatcher{
  constructor(){
  }

  createDir(directory,startingPath){
    return new Promise((resolve)=>{
      var percorso = path.join(startingPath?startingPath:__dirname,directory)
      if(fs.existsSync(percorso)){
        resolve(percorso)
      }else{
        fs.mkdirSync(percorso)
        resolve(percorso)
      }
    })
  }

  round(number,decimals){
    var result = number
    if (decimals){
      result=Math.round(number*Math.pow(10,decimals))/Math.pow(10,decimals)
    }    
    return result 
  }

  getAllPairs(quote,activePairs,justTrading,pairsToExclude){
    return new Promise((resolve,reject)=>{
      var options = {
        'method': 'GET',
        'url': 'https://api.binance.com/api/v1/exchangeInfo',
        'headers': {
        }
      };
      request(options, function (error, response) {
        if (error) throw new Error(error);
        var symbols = JSON.parse(response.body).symbols
        if (justTrading){
          var upact = activePairs.map((x)=>{return x.toUpperCase()})
          console.log(upact.length)
          symbols=symbols.map((x)=>{
            if(_.includes(upact,x.symbol.toUpperCase())){
              return x
            }
          }).filter((x)=>{if(x) return x})
          console.log(_.difference(upact,symbols.map((x)=>{return x.symbol})))
        }
        var justUSDTpairs = symbols.map((x)=>{
          if(x.quoteAsset.includes(quote)&&x.status==="TRADING"&&_.includes(pairsToExclude,x.baseAsset)!=true){
            return x.baseAsset
          }
        }).filter((x)=>{if(x){return x}})

        fs.writeFileSync(path.join(__dirname,'allTargets_'+quote.toUpperCase()),JSON.stringify(justUSDTpairs))
        if(justUSDTpairs.length>0){
          resolve(justUSDTpairs)
        }
        else{
          reject(null)
        }
      });
    })
  }

  getCandles(base, quote, timeframe){
    return new Promise((resolve)=>{
      var options = {
        'method': 'GET',
        'url': `https://api.binance.com/api/v3/klines?symbol=${base.toUpperCase()+quote.toUpperCase()}&interval=${timeframe}&limit=1000`,
        'headers': {
        }
      };
      var saveName = `${base.toUpperCase()+quote.toUpperCase()}-${timeframe}_candles`
      return new Promise((resolve)=>{
        request(options, function (error, response) {
          if (error) throw new Error(error);
          //console.log(JSON.parse(response.body));
          var candles= (JSON.parse(response.body)).map((x)=>{
            return {
              timestamp:x[0],
              formattedTimestamp:new Date(x[0]),
              Close:x[4],
              Open:x[1],
              High:x[2],
              Low:x[3],
              Volume:x[5]
            }
          })
          candles.pop()
          resolve(candles)
        });
      }).then((synthCandles)=>{
        this.createDir(`Candele_${quote.toUpperCase()}`).then((percorso)=>{
          this.createDir(`${timeframe}`,percorso).then((percorso)=>{
            var destinazione =path.join(percorso,saveName) 
            if(fs.existsSync(destinazione)!=true){
              fs.writeFileSync(destinazione,JSON.stringify(synthCandles))
              resolve(destinazione)  
            }
            else{
              var candele_gia_salvate = JSON.parse(fs.readFileSync(destinazione))
              var nuove_candele = _.differenceBy(synthCandles,candele_gia_salvate,"timestamp")
              var candele_aggiornate = candele_gia_salvate.concat(nuove_candele)
              fs.writeFileSync(destinazione,JSON.stringify(candele_aggiornate))
              resolve(destinazione)  
            }
          })
        })
      })
    })
  }

  fetchCandlesFromAllPairs(quote,timeframe,periodCall,activePairs,justTrading,pairsToExclude){
    return new Promise((resolve)=>{
      console.log("Collecting Candles...")
      this.getAllPairs(quote,activePairs,justTrading,pairsToExclude).then(async(tutteLecoppie)=>{
        var p = (z)=> new Promise((res)=>{
          console.log(`Pairs left ${quote}_${timeframe}:`,tutteLecoppie.length-(z+1),`(current:${tutteLecoppie[z]})`)
          this.getCandles(tutteLecoppie[z],quote,timeframe).then(()=>{
            res()
          })
        })
        for(var z=0;z<tutteLecoppie.length;z++){
          await p(z)
        }
        console.log("Done! Collected candles from",tutteLecoppie.length,"pairs")
        resolve()
      })
    })
  }

  expectedReturn(parsedData){
    var returns =[]
    var summedReturns=0
    for(var i=0;i<parsedData.length-1;i++){
      var r=(parsedData[i].Close/parsedData[i+1].Close)-1
      summedReturns+=r
      returns.push(r)
    }
    var e_r=summedReturns/returns.length
    return e_r
  }

  variance(parsedData,e_r){
    var summedSquaredDifferences=0
    for(var i=0;i<parsedData.length-1;i++){
      var squaredDifference=Math.pow(((parsedData[i].Close/parsedData[i+1].Close)-1)-e_r,2)
      summedSquaredDifferences+=squaredDifference
    }
    var variance = summedSquaredDifferences/(parsedData.length-1)
    return variance
  }

  standardDeviation(variance){
    var standardDeviation=Math.pow(variance,0.5)
    return standardDeviation
  }
  
  VaR(parsedData){
    try{
      return ss.quantile(parsedData,0.05)
    }
    catch(e){
      return null
    }
  }

  ninetyfifthPerc(parsedData){
    try{
      return ss.quantile(parsedData,0.95)
    }
    catch(e){
      return null
    }
  }

  skewness(parsedData){
    try{
      return ss.sampleSkewness(parsedData)
    }
    catch(e){
      return null
    }
  }

  kurtosis(parsedData){
    try{
      return ss.sampleKurtosis(parsedData)
    }
    catch(e){
      return null
    }
  }

  downsSideRisk(parsedData,target){
    try{
      var badReturns = parsedData.map((x)=>{
        if(x<target){
          return x
        }
      }).filter((x)=>{if(x)return x})
      return ss.standardDeviation(badReturns)
    }
    catch(e){
      return null
    }
  }

  singolaCoppiasintesiStatisticaDescrittiva(pair,parsedData,target){
    var e_r = this.expectedReturn(parsedData)
    var Variance = this.variance(parsedData,e_r)
    var stDev = this.standardDeviation(Variance)
    var arrayOfReturns = []
    for(var i=1;i<parsedData.length;i++){
      var r = (parsedData[i].Close/parsedData[i-1].Close)-1
      arrayOfReturns.push(r)
    }
    var VaR = this.VaR(arrayOfReturns)
    var ninetyfifthPerc=this.ninetyfifthPerc(arrayOfReturns)
    var skewness =this.skewness(arrayOfReturns)
    var kurtosis = this.kurtosis(arrayOfReturns)
    var sharpeR = e_r/stDev
    var downSideRisk = this.downsSideRisk(arrayOfReturns,target)
    var ogg = {
      pair:pair,
      expected_return:e_r,
      variance:Variance,
      standard_deviation:stDev,
      sharpe_ratio:sharpeR,
      value_at_risk:VaR,
      ninetyFifth_percentile:ninetyfifthPerc,
      skewness:skewness,
      kurtosis:kurtosis,
      downSideRisk:downSideRisk
    }
    return ogg
  }

  tutteLeCoppieSintesiStatisticaDescrittiva(quote,timeframe,numeroRichiesto,target){
    return new Promise((resolve)=>{
      return this.createDir(`Statistica_Descrittiva_UnicaSerie_${timeframe}`).then((percorso)=>{
        var TOTALPairs = fs.readdirSync(path.join(__dirname,`Candele_${quote.toUpperCase()}/${timeframe}`))
        var stats =[]
        var arrayOfAllLengths = []
        for(var i=0;i<TOTALPairs.length;i++){
          var pair = TOTALPairs[i].split('-')[0]
          var data=fs.readFileSync(path.join(__dirname,`Candele_${quote.toUpperCase()}/${timeframe}/${TOTALPairs[i]}`))
          if(JSON.parse(data).length>=numeroRichiesto){
            arrayOfAllLengths.push(JSON.parse(data).length)
          }
        }
        var minimumCommonLength = _.min(arrayOfAllLengths)
        for(var i=0;i<TOTALPairs.length;i++){
          var pair = TOTALPairs[i].split('-')[0]
          var data=fs.readFileSync(path.join(__dirname,`Candele_${quote.toUpperCase()}/${timeframe}/${TOTALPairs[i]}`))
          if(JSON.parse(data).length>=numeroRichiesto){
            var parsedData = JSON.parse(data).reverse().splice(0,minimumCommonLength)
            var stat = this.singolaCoppiasintesiStatisticaDescrittiva(pair,parsedData,target)
            stat.number_of_records = parsedData.length
            stats.push(stat)
          }
        }
        var savename = `all_pairs_${quote.toUpperCase()}_${timeframe}`
        var destinazione=path.join(percorso,savename)
        fs.writeFileSync(destinazione,JSON.stringify(stats))
        console.log("Stats saved!")
        resolve()
      })
    })
  }

  tutteLeCoppieSintesiStatisticaDescrittivaConIntervalloTemporale(quote,timeframe,data_inizio,data_fine,numeroRichiesto){
    return this.createDir(`Statistica_Descrittiva_UnicaSerie_${timeframe}`).then((percorso)=>{
      var InitialTOTALPairs = fs.readdirSync(path.join(__dirname,`Candele_${quote.toUpperCase()}/${timeframe}`))
      var TOTALPairs=InitialTOTALPairs
      var stats =[]
      var arrayOfAllLengths = []
      for(var i=0;i<TOTALPairs.length;i++){
        var pair = TOTALPairs[i].split('-')[0]
        var data=fs.readFileSync(path.join(__dirname,`Candele_${quote.toUpperCase()}/${timeframe}/${TOTALPairs[i]}`))
        if(JSON.parse(data).length>=numeroRichiesto){
          arrayOfAllLengths.push(JSON.parse(data).length)
        }
      }
      var minimumCommonLength = _.min(arrayOfAllLengths)
      for(var i=0;i<TOTALPairs.length;i++){
        var pair = TOTALPairs[i].split('-')[0]
        var data=fs.readFileSync(path.join(__dirname,`Candele_${quote.toUpperCase()}/${timeframe}/${TOTALPairs[i]}`))
        if(JSON.parse(data).length>=numeroRichiesto){
          var parsedData = JSON.parse(data).reverse().splice(0,minimumCommonLength).map((x)=>{
            if (new Date(x.formattedTimestamp).getTime()>=new Date(data_inizio).getTime() && new Date(x.formattedTimestamp).getTime()<=new Date(data_fine).getTime()){
              return x
            }
          }).filter((x)=>{if(x)return x})
          var stat = this.singolaCoppiasintesiStatisticaDescrittiva(pair,parsedData)
          stats.push(stat)
        }
      }
      stats=stats.filter((x)=>{if(x.expected_return)return x})
      var savename = `all_pairs_${quote.toUpperCase()}_${timeframe}_(${data_inizio.split("T").shift()}-${data_fine.split("T").shift()})`
      var destinazione=path.join(percorso,savename)
      fs.writeFileSync(destinazione,JSON.stringify(stats))
      console.log("Stats saved!")
    })
  }

  topNSharpeRatio(quote,timeframe,n,synth){
    return new Promise((resolve)=>{
      this.createDir("Sharpes").then((perc)=>{
        var percorso = path.join(__dirname,`Statistica_Descrittiva_UnicaSerie_${timeframe}`)
        var data = fs.readFileSync(path.join(percorso,`all_pairs_${quote.toUpperCase()}_${timeframe}`))
        var parsedData = JSON.parse(data)
        var bestSharpes = _.sortBy(parsedData,"sharpe_ratio").reverse().map((x)=>{
          if(x.sharpe_ratio){
            return x
          }
        }).filter((x)=>{if(x)return x}).splice(0,n)
        if (synth){
          bestSharpes=bestSharpes.map((x)=>{
            var w = {
              pair:x.pair,
              expected_return:x.expected_return,
              sharpe_ratio:x.sharpe_ratio
            }
            return w
          })
        }
        fs.writeFileSync(path.join(perc,`best_sharpes_${quote.toUpperCase()}_${timeframe}.json`), JSON.stringify(bestSharpes))
        resolve(bestSharpes)
      })
    })
  }

  CovarianceMATRIX(arrayOfReturns,arrayofAllPairs,quote,time_f){
    return new Promise((resolve)=>{
      var arrayoflengths = arrayOfReturns.map((x)=>{
        return x.length
      }).filter((x)=>{if(x)return x})
      var minimumCommonLength=_.min(arrayoflengths)
      arrayOfReturns=arrayOfReturns.map((x)=>{
          return x.reverse().splice(0,minimumCommonLength) //we are sure that the pairs will remain the same since anyone will return undefined
      })//.filter((x)=>{if(x) return x})
      var covarianceMatrix = {}
      //COMPUTE COVARIANCE MATRIX → since the matrix is symmetric, each array will be the row and the column of the given index
      for(var i=0;i<arrayOfReturns.length;i++){
          var covarianceRow =[]
          for(var j =0; j<arrayOfReturns.length;j++){
              var covariance=ss.sampleCovariance(arrayOfReturns[i],arrayOfReturns[j])
              // console.log(covariance)
              covarianceRow.push(covariance)
          }
          covarianceMatrix[arrayofAllPairs[i]]=(covarianceRow)
      }
      this.createDir('Matrici_Covarianze').then((perc)=>{
        fs.writeFileSync(path.join(perc,`Cov_Matrix_${quote.toUpperCase()}_${time_f}.json`),JSON.stringify(covarianceMatrix))
      })
      resolve(covarianceMatrix)
    })
  }

  filteredPairs(arrayOfAllCandles,moreThanNCandles,arrayofAllPairs){
    var filteredPairs=[]
    for(var z=0;z<arrayOfAllCandles.length;z++){
        if (arrayOfAllCandles[z].length>moreThanNCandles){
            filteredPairs.push(arrayofAllPairs[z])
        }
    }
    return filteredPairs
  }

  arrayOfALLReturnsofALLPAirs(arrayOfAllCandles,moreThanNCandles){
    arrayOfAllCandles=arrayOfAllCandles.map((x)=>{
        if(x.length>moreThanNCandles){
            return x
        }
    }).filter((x)=>{if(x)return x})
    var arrayOfAllReturns = []
    for(var i=0; i<arrayOfAllCandles.length;i++){
        var arrayOfReturns = []
        for(var j=1;j<arrayOfAllCandles[i].length;j++){
            var r = ((arrayOfAllCandles[i][j])/(arrayOfAllCandles[i][j-1]))-1
            arrayOfReturns.push(r)
        }
        arrayOfAllReturns.push(arrayOfReturns)
    }
    return arrayOfAllReturns
  }

  portafoglioOttimo(quote,tf,arrayOfReturns){ //shoutout to lequant40
    return new Promise((resolve)=>{
      try{
        var matriceCovarianza = JSON.parse(fs.readFileSync(path.join(__dirname,`Matrici_Covarianze/Cov_Matrix_${quote.toUpperCase()}_${tf}.json`)))
        var coppie = Object.keys(matriceCovarianza)
        var arrayoflengths = arrayOfReturns.map((x)=>{
          return x.length
        }).filter((x)=>{if(x)return x})
        var minimumCommonLength=_.min(arrayoflengths)
        arrayOfReturns=arrayOfReturns.map((x)=>{
            return x.reverse().splice(0,minimumCommonLength) //we are sure that the pairs will remain the same since anyone will return undefined
        })//.filter((x)=>{if(x) return x})
        var romanCovMatr = PortfolioAllocation.covarianceMatrix(arrayOfReturns)
        romanCovMatr.coppie=coppie
        var romanE = PortfolioAllocation.meanVector(arrayOfReturns)
        var pesiSharpes = PortfolioAllocation.maximumSharpeRatioWeights(romanE,romanCovMatr,0)
        var rendimentiPesati = []
        for(var z=0;z<arrayOfReturns.length;z++){
          var seriePesata =arrayOfReturns[z].map((x)=>{
            return x*pesiSharpes[z]
          }) 
          rendimentiPesati.push(seriePesata)
        }
        var OPFreturns = rendimentiPesati.reduce(function(a, b){ //succesione dei rendimenti del portafoglio ottimo
          return a.map(function(v,i){
              return v+b[i];
          });
        });

        var OPFerroreStandard = ss.sampleStandardDeviation(OPFreturns)/Math.pow(OPFreturns.length,0.5)
        var vettorePesiSharpes={}
        var arrayPesiOPF = []
        for (var i=0;i<coppie.length;i++){
          var w = {
            pair:coppie[i],
            weight:pesiSharpes[i]
          }
          vettorePesiSharpes[coppie[i]]=pesiSharpes[i]+`; (${Math.round(pesiSharpes[i]*Math.pow(10,4))/Math.pow(10,2)}%)`;
          arrayPesiOPF.push(w)
        }
    
        var rendimentoAttesoPortafoglio = 0
        for(var i=0;i<pesiSharpes.length;i++){
            var prodotto = pesiSharpes[i]*Array.from(romanE.data)[i]
            rendimentoAttesoPortafoglio+=prodotto
        }
        var statT=rendimentoAttesoPortafoglio/OPFerroreStandard
        var primaMatriceProdotto =[] //mi aspetto una matrice di una sola riga e di n colonne quante sono le coppie in portafoglio
        var arrayDiCOvarianze = Object.values(matriceCovarianza)
        for(var i=0;i<arrayDiCOvarianze.length;i++){
            var somma=0
            for(var z=0;z<arrayDiCOvarianze[i].length;z++){
                var prod=(arrayDiCOvarianze[i][z])*pesiSharpes[z]
                somma+=prod
            }
            primaMatriceProdotto.push(somma)
        }
        var deviazioneStandardPort = 0
        for(var i=0;i<primaMatriceProdotto.length;i++){
            deviazioneStandardPort+=(primaMatriceProdotto[i]*pesiSharpes[i])
        }
        deviazioneStandardPort=Math.pow(deviazioneStandardPort,0.5)
        var sharpe_ratio = rendimentoAttesoPortafoglio/deviazioneStandardPort
        var optimalPortfolio ={
            pesi:vettorePesiSharpes,
            statisticaT_rendimento_atteso:statT,
            numerosità_campione:OPFreturns.length,
            rendimento_atteso:rendimentoAttesoPortafoglio,
            deviazione_standard:deviazioneStandardPort,
            sharpe_ratio:sharpe_ratio
        }
        var sintesi = {
          rendimento_atteso:rendimentoAttesoPortafoglio,
          deviazione_standard:deviazioneStandardPort,
          sharpe_ratio:sharpe_ratio
        }
        arrayPesiOPF.push(sintesi)
        var esistePortafPrecedente = fs.existsSync(path.join(__dirname,`Portafogli_Ottimi/${tf}/OPF_${quote}_${tf}.json`))
        if(esistePortafPrecedente){
          var PortPrec = JSON.parse(fs.readFileSync(path.join(__dirname,`Portafogli_Ottimi/${tf}/OPF_${quote}_${tf}.json`)))
          if (PortPrec.pesi){
            var assetNuovi = Object.keys(optimalPortfolio.pesi)
            var pesiNuovi = Object.values(optimalPortfolio.pesi)
            var assetVecchi = Object.keys(PortPrec.pesi)
            var pesiVecchi = Object.keys(PortPrec.pesi)
            for(var i=0; i<assetNuovi.length; i++){
              if(optimalPortfolio.pesi[assetVecchi[i]]){
                optimalPortfolio.pesi[assetVecchi[i]]=optimalPortfolio.pesi[assetVecchi[i]]+`; ${Math.round(Number(Number(optimalPortfolio.pesi[assetVecchi[i]].split(";")[0])-Number(PortPrec.pesi[assetVecchi[i]].split(";")[0]))*Math.pow(10,4))/Math.pow(10,2)}%`
              }
            }
          }
        }
        this.createDir('Portafogli_Ottimi').then((perc)=>{
          this.createDir(tf,perc).then((percorso)=>{
            fs.writeFileSync(path.join(percorso,`OPF_${quote}_${tf}.json`),JSON.stringify(optimalPortfolio))
            this.createDir('Formato_Stealth',percorso).then((p)=>{
              fs.writeFileSync(path.join(p,`OPF_${quote}_${tf}_stealth.json`),JSON.stringify(arrayPesiOPF))
              this.createDir('CSV',percorso).then((p2)=>{
                var csvOPF = ''
                var soloCoppiaPeso = arrayPesiOPF.map((x)=>{
                  if (x.weight){
                    return x.pair+";"+x.weight
                  }
                }).filter((x)=>{if(x)return x})
                for(var i=0;i<soloCoppiaPeso.length;i++){
                  csvOPF+='BINANCE:'+soloCoppiaPeso[i]+'\n'
                }
                fs.writeFileSync(path.join(p2,`CSV_OPF_${quote}_${tf}.csv`),csvOPF)
                this.createDir('list_of_returns',p2).then((zz)=>{
                  var retOPF =''
                  for(var q=0;q<OPFreturns.length;q++){
                    retOPF+=OPFreturns[q]+'\n'
                  }
                  fs.writeFileSync(path.join(zz,`CSV_OPF_${quote}_${tf}_RETURNS.csv`),retOPF)
                })
              })
            })
          })
        })
        resolve(optimalPortfolio)
      }catch(e){
        console.log(e)
        this.createDir('Portafogli_Ottimi').then((perc)=>{
          this.createDir(tf,perc).then((percorso)=>{
            fs.writeFileSync(path.join(percorso,`OPF_${quote}_${tf}.json`),JSON.stringify(e))
          })
        })
        resolve(e)
      }
    })
  }

  mvp(quote,tf,arrayOfReturns){ //shoutout to lequant40
    return new Promise((resolve)=>{
      try{
        var matriceCovarianza = JSON.parse(fs.readFileSync(path.join(__dirname,`Matrici_Covarianze/Cov_Matrix_${quote.toUpperCase()}_${tf}.json`)))
        var coppie = Object.keys(matriceCovarianza)
        var arrayoflengths = arrayOfReturns.map((x)=>{
          return x.length
        }).filter((x)=>{if(x)return x})
        var minimumCommonLength=_.min(arrayoflengths)
        arrayOfReturns=arrayOfReturns.map((x)=>{
            return x.reverse().splice(0,minimumCommonLength) //we are sure that the pairs will remain the same since anyone will return undefined
        })//.filter((x)=>{if(x) return x})
        // console.log(arrayOfReturns) //ok
        var romanCovMatr = PortfolioAllocation.covarianceMatrix(arrayOfReturns)
        romanCovMatr.coppie=coppie
        var romanE = PortfolioAllocation.meanVector(arrayOfReturns)
        var pesiMVP = PortfolioAllocation.globalMinimumVarianceWeights(romanCovMatr)
        var rendimentiPesati = []
        for(var z=0;z<arrayOfReturns.length;z++){
          var seriePesata =arrayOfReturns[z].map((x)=>{
            return x*pesiMVP[z]
          }) 
          rendimentiPesati.push(seriePesata)
        }
        var MVPreturns = rendimentiPesati.reduce(function(a, b){ //succesione dei rendimenti del portafoglio ottimo
          return a.map(function(v,i){
              return v+b[i];
          });
        });
        var MVPerroreStandard = ss.sampleStandardDeviation(MVPreturns)/Math.pow(MVPreturns.length,0.5)
        var vettorepesiMVP={}
        var arrayPesiMVP = []
        for (var i=0;i<coppie.length;i++){
          var w = {
            pair:coppie[i],
            weight:pesiMVP[i]
          }
          vettorepesiMVP[coppie[i]]=pesiMVP[i]+`; (${Math.round(pesiMVP[i]*Math.pow(10,4))/Math.pow(10,2)}%)`;
          arrayPesiMVP.push(w)
        }
    
        var rendimentoAttesoPortafoglio = 0
        for(var i=0;i<pesiMVP.length;i++){
            var prodotto = pesiMVP[i]*Array.from(romanE.data)[i]
            rendimentoAttesoPortafoglio+=prodotto
        }
        var statT=rendimentoAttesoPortafoglio/MVPerroreStandard
        var primaMatriceProdotto =[] //mi aspetto una matrice di una sola riga e di n colonne quante sono le coppie in portafoglio
        var arrayDiCOvarianze = Object.values(matriceCovarianza)
        for(var i=0;i<arrayDiCOvarianze.length;i++){
            var somma=0
            for(var z=0;z<arrayDiCOvarianze[i].length;z++){
                var prod=(arrayDiCOvarianze[i][z])*pesiMVP[z]
                somma+=prod
            }
            primaMatriceProdotto.push(somma)
        }
        var deviazioneStandardPort = 0
        for(var i=0;i<primaMatriceProdotto.length;i++){
            deviazioneStandardPort+=(primaMatriceProdotto[i]*pesiMVP[i])
        }
        deviazioneStandardPort=Math.pow(deviazioneStandardPort,0.5)
        var sharpe_ratio = rendimentoAttesoPortafoglio/deviazioneStandardPort
        var mvpPortfolio ={
            pesi:vettorepesiMVP,
            statisticaT_rendimento_atteso:statT,
            numerosità_campione:MVPreturns.length,
            rendimento_atteso:rendimentoAttesoPortafoglio,
            deviazione_standard:deviazioneStandardPort,
            sharpe_ratio:sharpe_ratio
        }
        var sintesi = {
          rendimento_atteso:rendimentoAttesoPortafoglio,
          deviazione_standard:deviazioneStandardPort,
          sharpe_ratio:sharpe_ratio
        }
        arrayPesiMVP.push(sintesi)
        var esistePortafPrecedente = fs.existsSync(path.join(__dirname,`Portafogli_Varianza_Minima/${tf}/MVP_${quote}_${tf}.json`))
        if(esistePortafPrecedente){
          var PortPrec = JSON.parse(fs.readFileSync(path.join(__dirname,`Portafogli_Varianza_Minima/${tf}/MVP_${quote}_${tf}.json`)))
          if (PortPrec.pesi){
            var assetNuovi = Object.keys(mvpPortfolio.pesi)
            var pesiNuovi = Object.values(mvpPortfolio.pesi)
            var assetVecchi = Object.keys(PortPrec.pesi)
            var pesiVecchi = Object.keys(PortPrec.pesi)
            for(var i=0; i<assetNuovi.length; i++){
              if(mvpPortfolio.pesi[assetVecchi[i]]){
                mvpPortfolio.pesi[assetVecchi[i]]=mvpPortfolio.pesi[assetVecchi[i]]+`; ${Math.round(Number(Number(mvpPortfolio.pesi[assetVecchi[i]].split(";")[0])-Number(PortPrec.pesi[assetVecchi[i]].split(";")[0]))*Math.pow(10,4))/Math.pow(10,2)}%`
              }
            }
          }
        }
        this.createDir('Portafogli_Varianza_Minima').then((perc)=>{
          this.createDir(tf,perc).then((percorso)=>{
            fs.writeFileSync(path.join(percorso,`MVP_${quote}_${tf}.json`),JSON.stringify(mvpPortfolio))
            this.createDir('Formato_Stealth',percorso).then((p)=>{
              fs.writeFileSync(path.join(p,`MVP_${quote}_${tf}_stealth.json`),JSON.stringify(arrayPesiMVP))
              this.createDir('CSV',percorso).then((p2)=>{
                var csvMVP = ''
                var soloCoppiaPeso = arrayPesiMVP.map((x)=>{
                  if (x.weight){
                    return x.pair+";"+x.weight
                  }
                }).filter((x)=>{if(x)return x})
                for(var i=0;i<soloCoppiaPeso.length;i++){
                  csvMVP+='BINANCE:'+soloCoppiaPeso[i]+'\n'
                }
                fs.writeFileSync(path.join(p2,`CSV_MVP_${quote}_${tf}.csv`),csvMVP)
                this.createDir('list_of_returns',p2).then((zz)=>{
                  var retMVP =''
                  for(var q=0;q<MVPreturns.length;q++){
                    retMVP+=MVPreturns[q]+'\n'
                  }
                  fs.writeFileSync(path.join(zz,`CSV_MVP_${quote}_${tf}_RETURNS.csv`),retMVP)
                })
              })
            })
          })
        })
        resolve(mvpPortfolio)
      }catch(e){
        console.log(e)
        this.createDir('Portafogli_Varianza_Minima').then((perc)=>{
          this.createDir(tf,perc).then((percorso)=>{
            fs.writeFileSync(path.join(percorso,`MVP_${quote}_${tf}.json`),JSON.stringify(e))
          })
        })
        resolve(e)
      }
    })
  }
  
  portafoglioEquiponderato(quote,tf,arrayOfReturns){ //shoutout to lequant40
    return new Promise((resolve)=>{
      try{
        var matriceCovarianza = JSON.parse(fs.readFileSync(path.join(__dirname,`Matrici_Covarianze/Cov_Matrix_${quote.toUpperCase()}_${tf}.json`)))
        var coppie = Object.keys(matriceCovarianza)
        var arrayoflengths = arrayOfReturns.map((x)=>{
          return x.length
        }).filter((x)=>{if(x)return x})
        var minimumCommonLength=_.min(arrayoflengths)
        arrayOfReturns=arrayOfReturns.map((x)=>{
            return x.reverse().splice(0,minimumCommonLength) //we are sure that the pairs will remain the same since anyone will return undefined
        })//.filter((x)=>{if(x) return x})
        // console.log(arrayOfReturns) //ok
        var romanCovMatr = PortfolioAllocation.covarianceMatrix(arrayOfReturns)
        romanCovMatr.coppie=coppie
        var romanE = PortfolioAllocation.meanVector(arrayOfReturns)
        var pesiUguali = []
        for(var i=0;i<coppie.length;i++){
          pesiUguali.push(1/coppie.length)
        }
        var rendimentiPesati = []
        for(var z=0;z<arrayOfReturns.length;z++){
          var seriePesata =arrayOfReturns[z].map((x)=>{
            return x*pesiUguali[z]
          }) 
          rendimentiPesati.push(seriePesata)
        }
        var sameWeightReturns = rendimentiPesati.reduce(function(a, b){ //succesione dei rendimenti del portafoglio ottimo
          return a.map(function(v,i){
              return v+b[i];
          });
        });
        var EquiponderatoerroreStandard = ss.sampleStandardDeviation(sameWeightReturns)/Math.pow(sameWeightReturns.length,0.5)
        var vettorepesiUguali={}
        var arraypesiUguali = []
        for (var i=0;i<coppie.length;i++){
          var w = {
            pair:coppie[i],
            weight:pesiUguali[i]
          }
          vettorepesiUguali[coppie[i]]=pesiUguali[i]+`; (${Math.round(pesiUguali[i]*Math.pow(10,4))/Math.pow(10,2)}%)`;
          arraypesiUguali.push(w)
        }
    
        var rendimentoAttesoPortafoglio = 0
        for(var i=0;i<pesiUguali.length;i++){
            var prodotto = pesiUguali[i]*Array.from(romanE.data)[i]
            rendimentoAttesoPortafoglio+=prodotto
        }
        var statT=rendimentoAttesoPortafoglio/EquiponderatoerroreStandard
        var primaMatriceProdotto =[] //mi aspetto una matrice di una sola riga e di n colonne quante sono le coppie in portafoglio
        var arrayDiCOvarianze = Object.values(matriceCovarianza)
        for(var i=0;i<arrayDiCOvarianze.length;i++){
            var somma=0
            for(var z=0;z<arrayDiCOvarianze[i].length;z++){
                var prod=(arrayDiCOvarianze[i][z])*pesiUguali[z]
                somma+=prod
            }
            primaMatriceProdotto.push(somma)
        }
        var deviazioneStandardPort = 0
        for(var i=0;i<primaMatriceProdotto.length;i++){
            deviazioneStandardPort+=(primaMatriceProdotto[i]*pesiUguali[i])
        }
        deviazioneStandardPort=Math.pow(deviazioneStandardPort,0.5)
        var sharpe_ratio = rendimentoAttesoPortafoglio/deviazioneStandardPort
        var EquiponderatoPortfolio ={
            pesi:vettorepesiUguali,
            statisticaT_rendimento_atteso:statT,
            numerosità_campione:sameWeightReturns.length,
            rendimento_atteso:rendimentoAttesoPortafoglio,
            deviazione_standard:deviazioneStandardPort,
            sharpe_ratio:sharpe_ratio
        }
        var sintesi = {
          rendimento_atteso:rendimentoAttesoPortafoglio,
          deviazione_standard:deviazioneStandardPort,
          sharpe_ratio:sharpe_ratio
        }
        arraypesiUguali.push(sintesi)
        var esistePortafPrecedente = fs.existsSync(path.join(__dirname,`Portafogli_Equiponderati/${tf}/Equiponderato_${quote}_${tf}.json`))
        if(esistePortafPrecedente){
          var PortPrec = JSON.parse(fs.readFileSync(path.join(__dirname,`Portafogli_Equiponderati/${tf}/Equiponderato_${quote}_${tf}.json`)))
          if (PortPrec.pesi){
            var assetNuovi = Object.keys(EquiponderatoPortfolio.pesi)
            var pesiNuovi = Object.values(EquiponderatoPortfolio.pesi)
            var assetVecchi = Object.keys(PortPrec.pesi)
            var pesiVecchi = Object.keys(PortPrec.pesi)
            for(var i=0; i<assetNuovi.length; i++){
              if(EquiponderatoPortfolio.pesi[assetVecchi[i]]){
                EquiponderatoPortfolio.pesi[assetVecchi[i]]=EquiponderatoPortfolio.pesi[assetVecchi[i]]+`; ${Math.round(Number(Number(EquiponderatoPortfolio.pesi[assetVecchi[i]].split(";")[0])-Number(PortPrec.pesi[assetVecchi[i]].split(";")[0]))*Math.pow(10,4))/Math.pow(10,2)}%`
              }
            }
          }
        }
        this.createDir('Portafogli_Equiponderati').then((perc)=>{
          this.createDir(tf,perc).then((percorso)=>{
            fs.writeFileSync(path.join(percorso,`Equiponderato_${quote}_${tf}.json`),JSON.stringify(EquiponderatoPortfolio))
            this.createDir('Formato_Stealth',percorso).then((p)=>{
              fs.writeFileSync(path.join(p,`Equiponderato_${quote}_${tf}_stealth.json`),JSON.stringify(arraypesiUguali))
              this.createDir('CSV',percorso).then((p2)=>{
                var csvEquiponderato = ''
                var soloCoppiaPeso = arraypesiUguali.map((x)=>{
                  if (x.weight){
                    return x.pair+";"+x.weight
                  }
                }).filter((x)=>{if(x)return x})
                for(var i=0;i<soloCoppiaPeso.length;i++){
                  csvEquiponderato+='BINANCE:'+soloCoppiaPeso[i]+'\n'
                }
                fs.writeFileSync(path.join(p2,`CSV_Equiponderato_${quote}_${tf}.csv`),csvEquiponderato)
                this.createDir('list_of_returns',p2).then((zz)=>{
                  var retEquiponderato =''
                  for(var q=0;q<sameWeightReturns.length;q++){
                    retEquiponderato+=sameWeightReturns[q]+'\n'
                  }
                  fs.writeFileSync(path.join(zz,`CSV_Equiponderato_${quote}_${tf}_RETURNS.csv`),retEquiponderato)
                })
              })
            })
          })
        })
        resolve(EquiponderatoPortfolio)
      }catch(e){
        console.log(e)
        this.createDir('Portafogli_Equiponderati').then((perc)=>{
          this.createDir(tf,perc).then((percorso)=>{
            fs.writeFileSync(path.join(percorso,`Equiponderato_${quote}_${tf}.json`),JSON.stringify(e))
          })
        })
        resolve(e)
      }
    })
  }

  crp(quote,tf,arrayOfReturns){ //shoutout to lequant40
    return new Promise((resolve)=>{
      try{
        var matriceCovarianza = JSON.parse(fs.readFileSync(path.join(__dirname,`Matrici_Covarianze/Cov_Matrix_${quote.toUpperCase()}_${tf}.json`)))
        var coppie = Object.keys(matriceCovarianza)
        var arrayoflengths = arrayOfReturns.map((x)=>{
          return x.length
        }).filter((x)=>{if(x)return x})
        var minimumCommonLength=_.min(arrayoflengths)
        arrayOfReturns=arrayOfReturns.map((x)=>{
            return x.reverse().splice(0,minimumCommonLength) //we are sure that the pairs will remain the same since anyone will return undefined
        })//.filter((x)=>{if(x) return x})
        // console.log(arrayOfReturns) //ok
        var romanCovMatr = PortfolioAllocation.covarianceMatrix(arrayOfReturns)
        romanCovMatr.coppie=coppie
        var romanE = PortfolioAllocation.meanVector(arrayOfReturns)
        var pesiCRP = PortfolioAllocation.clusterRiskParityWeights(romanCovMatr)
        var rendimentiPesati = []
        for(var z=0;z<arrayOfReturns.length;z++){
          var seriePesata =arrayOfReturns[z].map((x)=>{
            return x*pesiCRP[z]
          }) 
          rendimentiPesati.push(seriePesata)
        }
        var CRPreturns = rendimentiPesati.reduce(function(a, b){ //succesione dei rendimenti del portafoglio ottimo
          return a.map(function(v,i){
              return v+b[i];
          });
        });
        var CRPerroreStandard = ss.sampleStandardDeviation(CRPreturns)/Math.pow(CRPreturns.length,0.5)
        var vettorepesiCRP={}
        var arrayPesiCRP = []
        for (var i=0;i<coppie.length;i++){
          var w = {
            pair:coppie[i],
            weight:pesiCRP[i]
          }
          vettorepesiCRP[coppie[i]]=pesiCRP[i]+`; (${Math.round(pesiCRP[i]*Math.pow(10,4))/Math.pow(10,2)}%)`;
          arrayPesiCRP.push(w)
        }
    
        var rendimentoAttesoPortafoglio = 0
        for(var i=0;i<pesiCRP.length;i++){
            var prodotto = pesiCRP[i]*Array.from(romanE.data)[i]
            rendimentoAttesoPortafoglio+=prodotto
        }
        var statT=rendimentoAttesoPortafoglio/CRPerroreStandard
        var primaMatriceProdotto =[] //mi aspetto una matrice di una sola riga e di n colonne quante sono le coppie in portafoglio
        var arrayDiCOvarianze = Object.values(matriceCovarianza)
        for(var i=0;i<arrayDiCOvarianze.length;i++){
            var somma=0
            for(var z=0;z<arrayDiCOvarianze[i].length;z++){
                var prod=(arrayDiCOvarianze[i][z])*pesiCRP[z]
                somma+=prod
            }
            primaMatriceProdotto.push(somma)
        }
        var deviazioneStandardPort = 0
        for(var i=0;i<primaMatriceProdotto.length;i++){
            deviazioneStandardPort+=(primaMatriceProdotto[i]*pesiCRP[i])
        }
        deviazioneStandardPort=Math.pow(deviazioneStandardPort,0.5)
        var sharpe_ratio = rendimentoAttesoPortafoglio/deviazioneStandardPort
        var CRPPortfolio ={
            pesi:vettorepesiCRP,
            statisticaT_rendimento_atteso:statT,
            numerosità_campione:CRPreturns.length,
            rendimento_atteso:rendimentoAttesoPortafoglio,
            deviazione_standard:deviazioneStandardPort,
            sharpe_ratio:sharpe_ratio
        }
        var sintesi = {
          rendimento_atteso:rendimentoAttesoPortafoglio,
          deviazione_standard:deviazioneStandardPort,
          sharpe_ratio:sharpe_ratio
        }
        arrayPesiCRP.push(sintesi)
        var esistePortafPrecedente = fs.existsSync(path.join(__dirname,`Portafogli_cluster_risk_parity/${tf}/CRP_${quote}_${tf}.json`))
        if(esistePortafPrecedente){
          var PortPrec = JSON.parse(fs.readFileSync(path.join(__dirname,`Portafogli_cluster_risk_parity/${tf}/CRP_${quote}_${tf}.json`)))
          if (PortPrec.pesi){
            var assetNuovi = Object.keys(CRPPortfolio.pesi)
            var pesiNuovi = Object.values(CRPPortfolio.pesi)
            var assetVecchi = Object.keys(PortPrec.pesi)
            var pesiVecchi = Object.keys(PortPrec.pesi)
            for(var i=0; i<assetNuovi.length; i++){
              if(CRPPortfolio.pesi[assetVecchi[i]]){
                CRPPortfolio.pesi[assetVecchi[i]]=CRPPortfolio.pesi[assetVecchi[i]]+`; ${Math.round(Number(Number(CRPPortfolio.pesi[assetVecchi[i]].split(";")[0])-Number(PortPrec.pesi[assetVecchi[i]].split(";")[0]))*Math.pow(10,4))/Math.pow(10,2)}%`
              }
            }
          }
        }
        this.createDir('Portafogli_cluster_risk_parity').then((perc)=>{
          this.createDir(tf,perc).then((percorso)=>{
            fs.writeFileSync(path.join(percorso,`CRP_${quote}_${tf}.json`),JSON.stringify(CRPPortfolio))
            this.createDir('Formato_Stealth',percorso).then((p)=>{
              fs.writeFileSync(path.join(p,`CRP_${quote}_${tf}_stealth.json`),JSON.stringify(arrayPesiCRP))
              this.createDir('CSV',percorso).then((p2)=>{
                var csvCRP = ''
                var soloCoppiaPeso = arrayPesiCRP.map((x)=>{
                  if (x.weight){
                    return x.pair+";"+x.weight
                  }
                }).filter((x)=>{if(x)return x})
                for(var i=0;i<soloCoppiaPeso.length;i++){
                  csvCRP+='BINANCE:'+soloCoppiaPeso[i]+'\n'
                }
                fs.writeFileSync(path.join(p2,`CSV_CRP_${quote}_${tf}.csv`),csvCRP)
                this.createDir('list_of_returns',p2).then((zz)=>{
                  var retCRP =''
                  for(var q=0;q<CRPreturns.length;q++){
                    retCRP+=CRPreturns[q]+'\n'
                  }
                  fs.writeFileSync(path.join(zz,`CSV_CRP_${quote}_${tf}_RETURNS.csv`),retCRP)
                })
              })
            })
          })
        })
        resolve(CRPPortfolio)
      }catch(e){
        console.log(e)
        this.createDir('Portafogli_cluster_risk_parity').then((perc)=>{
          this.createDir(tf,perc).then((percorso)=>{
            fs.writeFileSync(path.join(percorso,`CRP_${quote}_${tf}.json`),JSON.stringify(e))
          })
        })
        resolve(e)
      }
    })
  }

  efficientFrontier(quote,tf,arrayOfReturns){ //shoutout to lequant40
    return new Promise((resolve)=>{
      try{
        var matriceCovarianza = JSON.parse(fs.readFileSync(path.join(__dirname,`Matrici_Covarianze/Cov_Matrix_${quote.toUpperCase()}_${tf}.json`)))
        var coppie = Object.keys(matriceCovarianza)
        var arrayoflengths = arrayOfReturns.map((x)=>{
          return x.length
        }).filter((x)=>{if(x)return x})
        var minimumCommonLength=_.min(arrayoflengths)
        arrayOfReturns=arrayOfReturns.map((x)=>{
            return x.reverse().splice(0,minimumCommonLength) //we are sure that the pairs will remain the same since anyone will return undefined
        })//.filter((x)=>{if(x) return x})
        // console.log(arrayOfReturns) //ok
        var romanCovMatr = PortfolioAllocation.covarianceMatrix(arrayOfReturns)
        romanCovMatr.coppie=coppie
        var romanE = PortfolioAllocation.meanVector(arrayOfReturns)
        var efficientF = PortfolioAllocation.meanVarianceEfficientFrontierPortfolios(romanE,romanCovMatr)
        var portafogliEfficienti = efficientF.map((x)=>{
          var w ={}
          x.shift().map((x,i)=>{
            w[coppie[i]]=x
          })
          
          var rendimentoAtteso = x.shift()
          var standard_deviation = x.shift()
          var sharpe = rendimentoAtteso/standard_deviation
          return {
            weights: w,
            numerosità_campione:arrayOfReturns.length,
            expected_return: rendimentoAtteso,
            standard_deviation:standard_deviation,
            sharpe_ratio:sharpe
          }
        })
        this.createDir('Portafogli_Frontiere_Efficienti').then((perc)=>{
          this.createDir(tf,perc).then((percorso)=>{
            this.createDir(quote,percorso).then((perccc)=>{
              for(var i=0;i<portafogliEfficienti.length;i++){
                fs.writeFileSync(path.join(perccc,`Eficient_PF${i}_${quote}_${tf}.json`),JSON.stringify(portafogliEfficienti[i]))
              }
            })
          })
        })
        resolve(portafogliEfficienti)
      }catch(e){
        resolve(e)
      }
    })
  }

  tuttoInCsv(quote,tf,listaCoppie){//closes will be sorted from the most recent ones; listacoppie can be undefined
    return new Promise((resolve)=>{
      this.createDir("CSV").then((perc)=>{
        this.createDir(tf,perc).then((percorso)=>{
          var percorsoFile = path.join(__dirname,`Candele_${quote.toUpperCase()}/${tf}`)
          var tuttifiles = fs.readdirSync(percorsoFile)
          if (listaCoppie){
            tuttifiles=tuttifiles.map((x)=>{
              if(_.includes(listaCoppie,x.split("-")[0])){
                return x
              }
            }).filter((x)=>{if(x)return x})
          }
          var ob = {}
          for(var i=0;i<tuttifiles.length;i++){
            var data = fs.readFileSync(path.join(percorsoFile,tuttifiles[i]))
            var parsedData=JSON.parse(data)
            var justClose = parsedData.map((x)=>{
              return x.Close
            })
            ob[tuttifiles[i].split("-")[0]]=justClose
          }
          // console.log(ob)
          var keys = Object.keys(ob).toString()+'\n'
          var arrayOfLengths = Object.values(ob).map((x)=>{
            return x.length
          })
          var maximumLength = _.max(arrayOfLengths)
          var csv = keys
          for(var i=0;i<maximumLength;i++){
            var text=""
            Object.values(ob).map((x)=>{
              var t =x.pop()
              if(!t){
                t=""
              }
              text += t+","
            })
            csv+=text+'\n'
          }
          var nomeFile = listaCoppie?`CSV_${quote}_${tf}_selectedPairs(OPF)`:`CSV_${quote}_${tf}`
          fs.writeFileSync(path.join(percorso,nomeFile),csv)
          // return ob
          resolve(csv)
          //crea il csv partendo da tuttifiles
        })
      })
    })
  }

}

module.exports=BinanceWatcher