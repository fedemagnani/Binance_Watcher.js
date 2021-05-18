try{
    const electron = require('electron')
    const ipc = electron.ipcRenderer
    const $ = require('jquery');
    const fs = require('fs')
    const path = require('path')
    const quote ="ETH"
    const timeframe = "30m"

    var minxxx=0
    var minyyy=-0.003
    var maxxxx=0.1
    var maxyyy=0.003
    var MVP = JSON.parse(fs.readFileSync(path.join(__dirname,`../Portafogli_Varianza_Minima/${timeframe}/MVP_${quote}_${timeframe}.json`)))
    var Portafogli_Frontiere_Efficienti_Folder = fs.readdirSync(path.join(__dirname,`../Portafogli_Frontiere_Efficienti/${timeframe}/${quote}`))
    var frontieraEficiente = Portafogli_Frontiere_Efficienti_Folder.map((x)=>{
        var w = JSON.parse(fs.readFileSync(path.join(__dirname,`../Portafogli_Frontiere_Efficienti/${timeframe}/${quote}/${x}`)))
        w.name = x
        return w
    })
    var portafoglioOttimo = JSON.parse(fs.readFileSync(path.join(__dirname,`../Portafogli_Ottimi/${timeframe}/OPF_${quote}_${timeframe}.json`)))
    var tuttiIfiles = JSON.parse(fs.readFileSync(path.join(`../Statistica_Descrittiva_UnicaSerie_${timeframe}/all_pairs_${quote}_${timeframe}`)))
    var tuttiIDataSets = tuttiIfiles.map((x)=>{
            var etichetta = x.pair
            var r_color=`rgb(${Math.floor(Math.random() * 255) + 1 }, ${Math.floor(Math.random() * 255) + 1 }, ${Math.floor(Math.random() * 255) + 1 })`
            var ascissa = x.standard_deviation
            var ordinata = x.expected_return
            var width=10
            if (etichetta===`BTC${quote}`){
                r_color='rgb(255,215,0)'
                width=30
            }
            if (etichetta===`ETH${quote}`){
                r_color='rgb(105,105,105)'
                width=30
            }
            if (etichetta===`DOGE${quote}`){
                r_color='rgb(139,69,19)'
                width=30
            }
            if (etichetta===`ADA${quote}`){
                r_color='rgb(0,0,255)'
                width=30
            }
            if (etichetta===`LINK${quote}`){
                r_color='rgb(0,191,255)'
                width=30
            }
            if (etichetta===`BNB${quote}`){
                r_color='rgb(255,255,0)'
                width=30
            }
            var punto = {
                label:etichetta,
                data:[{x:ascissa,y:ordinata}],
                borderColor: r_color,
                backgroundColor: r_color,
                borderWidth:width
            }
            return punto
    }).filter((x)=>{if(x)return x})
    var tutteLeCoppie = tuttiIfiles.map((x)=>{
        return x.pair
    }).filter((x)=>{if(x)return x})
    var puntoOPF ={
        label:'Optimal Portfolio',
        data:[{x:portafoglioOttimo.deviazione_standard,y:portafoglioOttimo.rendimento_atteso}],
        borderColor: 'rgb(0,255,0)',
        backgroundColor: 'rgb(0,255,0)',
        borderWidth:35
    }
    tuttiIDataSets.push(puntoOPF)
    tutteLeCoppie.push('Optimal Portfolio')
    var puntoMVP = {
        label:'Minimum Variance Portfolio',
        data:[{x:MVP.deviazione_standard,y:MVP.rendimento_atteso}],
        borderColor: 'rgb(255, 0, 255)',
        backgroundColor: 'rgb(255, 0, 255)',
        borderWidth:35
    }
    tuttiIDataSets.push(puntoMVP)
    tutteLeCoppie.push('Minimum Variance Portfolio')
    frontieraEficiente.map((x)=>{
        tutteLeCoppie.push(x.name)
        var puntoEff = {
            label:x.name,
            data:[{x:x.standard_deviation,y:x.expected_return}],
            borderColor: 'rgb(0,0,0)',
            backgroundColor: 'rgb(0,0,0)',
            borderWidth:1
        }
        tuttiIDataSets.push(puntoEff)
    })
    const data = {
        labels:tutteLeCoppie,
        datasets: tuttiIDataSets
    };
    $('#maximum_y').val(maxyyy);
    $('#maximum_x').val(maxxxx);
    $('#minimum_y').val(minyyy);
    $('#minimum_x').val(minxxx);

    const config = {
        type: 'scatter',
        data: data,
        options: {
            tooltips: {
               callbacks: {
                  label: function(tooltipItem, data) {
                     var label = data.labels[tooltipItem.datasetIndex];
                     return label + ': (stdev=' + tooltipItem.xLabel + ', r=' + tooltipItem.yLabel + ')';
                  }
               }
            },
            legend:{
                display:false
            },
         }        
    };
    var cc=new Chart(
        document.getElementById('myChart').getContext('2d'),
        config
    );

    var resetCanvas = function(){
        $('#myChart').remove(); // this is my <canvas> element
        $('body').append('<canvas id="myChart"><canvas>');
      };

    function updateAxis(maxX,maxY,minX,minY){
        config.options.scales.xAxes=[{
            ticks: {
                min:minX,
                max: maxX // maximum value
            }
        }]
        config.options.scales.yAxes=[{
            ticks: {
                min:minY,
                max: maxY // maximum value
            }
        }]
        resetCanvas()
        cc=new Chart(
            document.getElementById('myChart').getContext('2d'),
            config
        );
    }

    function reset(){
        const configr = {
            type: 'scatter',
            data: data,
            options: {
                tooltips: {
                   callbacks: {
                      label: function(tooltipItem, data) {
                         var label = data.labels[tooltipItem.datasetIndex];
                         return label + ': (stdev=' + tooltipItem.xLabel + ', r=' + tooltipItem.yLabel + ')';
                      }
                   }
                },
                legend:{
                    display:false
                },
             }        
        };
        resetCanvas()
        cc=new Chart(
            document.getElementById('myChart').getContext('2d'),
            configr
        );
    }

    $(document).on('click','#updateaxis',(event)=>{
        var xxx = $('#maximum_x').val().trim()
        var yyy=$('#maximum_y').val().trim()
        var xxxm = $('#minimum_x').val().trim()
        var yyym=$('#minimum_y').val().trim()

        return updateAxis(Number(xxx),Number(yyy),Number(xxxm),Number(yyym))
    })

    $(document).on('click','#reset',(event)=>{
        return reset()
    })

    $(document).on('mousewheel DOMMouseScroll', function(event){
        if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
        }
        else {
        }
    });


}catch(e){alert(e)}
