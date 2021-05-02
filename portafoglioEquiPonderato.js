const fs = require('fs')
const path = require('path')
const _ = require('lodash')
var statisticaDescrittiva=JSON.parse(fs.readFileSync(path.join(__dirname,'Statistica_Descrittiva_UnicaSerie_1d/all_pairs_USDT_1d')))
var matriceCovarianza = JSON.parse(fs.readFileSync(path.join(__dirname,'Matrici_Covarianze/Cov_Matrix_USDT_1d.json')))
var coppie = Object.keys(matriceCovarianza)
var pesiUguali = []
for(var i=0;i<coppie.length;i++){
    pesiUguali.push(1/coppie.length)
}
var vettoreRendimentiAttesi=statisticaDescrittiva.map((x)=>{
    if(_.includes(coppie,x.pair)){
        return {
            pair:x.pair,
            rendimentoAtteso:x.expected_return
        }
    }
}).filter((x)=>{if(x)return x})

var rendimentoAttesoPortafoglio = 0
for(var i=0;i<pesiUguali.length;i++){
    var prodotto = pesiUguali[i]*vettoreRendimentiAttesi[i].rendimentoAtteso
    rendimentoAttesoPortafoglio+=prodotto
}

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
console.log(deviazioneStandardPort)