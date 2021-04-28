const fs = require('fs')
const _ = require('lodash')
const path = require('path')
var quote = "BTC"
var all = JSON.parse(fs.readFileSync(path.join(__dirname,`allTargets_${quote}`)))
var allGet = fs.readdirSync(path.join(__dirname,`Candele_${quote}/1d`)).map((x)=>{return x.split(quote).shift()})
var controlla = function(){
    console.log(all.length,allGet.length)
    var missing = _.difference(all,allGet)
    console.log(missing)
}
controlla()