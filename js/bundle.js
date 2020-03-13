window.$ = window.jQuery = require('jquery');
function compare(a, b) {
  const keyA = a.key.toLowerCase();
  const keyB = b.key.toLowerCase();

  let comparison = 0;
  if (keyA > keyB) {
    comparison = 1;
  } else if (keyA < keyB) {
    comparison = -1;
  }
  return comparison;
}
$( document ).ready(function() {
  const DATA_PATH = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTnZMN1guJCB44f-O6iP-JpNum4NJdL5Op5GEbrkAayk_V19UkmO56YzQ2vSsfVCVWl5eyOT-Yhh4Y-/pub?single=true&output=csv&gid=';
  const DATA_ID = 1103779481;
  const DATASET_COUNTS_ID = 733089483;
  const GLOBAL_COUNTS_ID = 2045883069;
  const COUNTRIES_ID = 735983640;

  var isMobile = $(window).width()<768 ? true : false;
  var countryCount, categoryCount, globalCounts, date;
  var rowCount = 0;
  var metricColors = {data1: '#007CE1', data2: '#C0D7EB', data3: '#E6E7E8'};
  var metricNames = {data1: 'Complete', data2: 'Incomplete', data3: 'No data'}
  var countryNames, datasetCounts = [];

  var tooltipActive = false;
  $(document).mousemove(function(event) {
    if (tooltipActive) {
      $('.tooltip').css({
        left: event.pageX - $('.tooltip').width()/2 - 14, 
        top: event.pageY - $('.tooltip').height() - 5
      });
    }
  });

  function getData() {
    Promise.all([
      d3.csv(DATA_PATH + DATA_ID),
      d3.csv(DATA_PATH + DATASET_COUNTS_ID),
      d3.csv(DATA_PATH + GLOBAL_COUNTS_ID),
      d3.csv(DATA_PATH + COUNTRIES_ID)
    ]).then(function(data){
      countryNames = data[3];
      globalCounts = data[2][0];
      datasetCounts = data[1];
      parseData(data[0]);
    });
  }

  function parseData(data) {
    var format = d3.timeFormat("%b %d, %Y");
    var d = (data[0]['Date']).split('-');
    d = new Date(d[0], d[1]-1, d[2]);
    date = format(d);

    //group the data by category
    var groupByCategory = d3.nest()
      .key(function(d){ return d['Category']; })
      .entries(data);
    categoryCount = groupByCategory.length;
    groupByCategory.sort(compare);
    groupByCategory.push({key:'TOTAL'});

    //group the data by country
    var groupByCountry = d3.nest()
      .key(function(d) { return d['ISO3']; })
      .key(function(d) { return d['Metric']; })
      .key(function(d) { return d['Category']; })
      .rollup(function(v) { return v[0]['Percentage']; })
      .entries(data);
    countryCount = groupByCountry.length;

    //generate charts
    generateCharts(groupByCategory, groupByCountry);
  }


  function generateCharts(categories, countries) {
    var chartName, chartData;
    var count = 0;
    var totals = {
      Complete: [],
      Incomplete: [],
      Empty: [],
    };
    countries.forEach(function(country) {
      //display categories in 1st column of every row
      count = (count==3) ? 0 : count+1;
      if (count==1) createCategories(categories);

      //create chart markup for each country
      chartData = [];
      chartName = country.key + "Chart";
      var countryName = getCountryName(country.key);
      var datasetCount = getDatasetCount(country.key);
      var colspan = (isMobile) ? 'col-1' : 'col-2';
      var status = (country.key == 'AFG') ? 'show' : '';
      $('.charts').append("<div class='" + colspan + " country-chart " + country.key + " " + status + "' data-country='" + country.key + "'><div class='chart-header'><img src='assets/flags/" + country.key + ".png'/><div>" + countryName + "<span>" + datasetCount + " datasets</span></div></div><div class='chart " + chartName + "'></div></div>");
      
      //metric 
      country.values.forEach(function(metric, index) {
        metric.values.sort(compare);
        var values = ['data'+(index+1)];
        //category
        metric.values.forEach(function(category) {
          values.push(Math.round(category.value*100));
        });
        //mean
        var mean = Math.round(d3.mean(values));
        totals[metric.key].push(mean)
        values.push(mean);
        chartData.push(values);
      });
      createBarChart(chartName, chartData);

      //build country dropdown
      $('.country-select').append(
        $('<option></option>').val(country.key).html(countryName)
      );
    });

    createOverview(totals);
    $('.country-select').change(onCountrySelect);

    $('.country-chart').click(function(event) {
      var country = $(event.currentTarget).attr('data-country');
      var url = 'https://data.humdata.org/group/' + country.toLowerCase();
      window.open(url, '_blank');
    });
  }


  function onCountrySelect() {
    $('.country-chart').removeClass('show');
    var target = '.country-chart.' + $('.country-select').val();
    // console.log($(target).find('.chart'))
    // var t = $(target).find('.chart');
    // console.log(t)
    // t.resize();
    // chart.flush();
    // console.log(chart)
    $(target).addClass('show');
  }

  function createOverview(totals) {
    //donut chart
    totals['Complete'] = Math.round(d3.mean(totals['Complete']));
    totals['Incomplete'] = Math.round(d3.mean(totals['Incomplete']));
    totals['Empty'] = Math.round(d3.mean(totals['Empty']));
    var metricTotals = Object.entries(totals);

    var chart = c3.generate({
      size: {
        height: 210
      },
      bindto: '.donut-chart',
      data: {
        columns: [
            ['data1', totals['Complete']],
            ['data2', totals['Incomplete']],
            ['data3', totals['Empty']]
        ],
        type: 'donut',
        names: metricNames,
        colors: metricColors,
        order: null
      },
      donut: {
        width: 45,
        label: {
          format: function (value, ratio, id) {
            return value+'%';
          }
        }
      }
    });

    var firstLegend = d3.select(".c3-legend-item");
    var legendContainer = d3.select(firstLegend.node().parentNode);
    var legendX = parseInt(firstLegend.select('text').attr('x'));
    var legendY = parseInt(firstLegend.select('text').attr('y'));
    legendContainer
      .attr('class', 'donut-legend-container')
      .append('text')
      .text('Global Data Grid Completeness:')
      .attr('class', 'donut-legend-title')
      .attr('x', legendX - 10)
      .attr('y', legendY - 20);

    //key figures
    metricTotals.forEach(function(metric, index) {
      var title = (metric[0] == 'Empty') ? 'Total Percentage No Data' : 'Total Percentage Data ' + metric[0];
      var value = metric[1] + '<span>%</span>';
      createKeyFigure(title, value);
    });


    createKeyFigure('Number of Locations', countryCount);
    createKeyFigure('Number of Categories', globalCounts['Category Count']);
    createKeyFigure('Number of Sub-categories', globalCounts['Subcategory Count']);
  }


  function createKeyFigure(title, value) {
    return $('.stats').append("<div class='key-figure'><div class='inner'><h3>"+ title +"</h3><div class='num'>"+ value +"</div><p class='date small'>"+ date +"</p></div></div></div>");
  }


  function createCategories(categories) {
    rowCount++;
    var colspan = (isMobile) ? 'col-1' : 'col-2';
    var icons = ['Affected-population', 'Coordination', 'Food-Security', 'Location', 'Health', 'People-in-need'];
    $('.charts').append("<div class='" + colspan + " categories category-list" + rowCount + "'><ul class='small'></ul></div>");

    categories.forEach(function(category, index) {
      var cat = (category.key == 'Population & Socio-economic Indicators') ? 'Population & Socio-economy' : category.key;
      $('.category-list' + rowCount + ' ul').append("<li>" + cat + " <div><i class='humanitarianicons-" + icons[index] + "'></i></div></li>");
    });

    //divider
    var svg = d3.select('.category-list'+rowCount)
      .append('svg')
      .attr('class', 'total-line')
      .append('line')
        .attr('stroke-width', 1)
        .attr('x1', 0)
        .attr('x2', 241);
  }

  
  function createBarChart(chartName, chartData) {
    var chart = c3.generate({
      size: {
        height: 200
      },
      bindto: '.' + chartName,
      data: {
        columns: chartData,
        names: metricNames,
        type: 'bar',
        onmouseover: function (d) {
          tooltipActive = true;
          $('.tooltip')
            .html(d.value + '% ' + d.name.toLowerCase())
            .css({display: 'block'});
        },
        onmouseout: function (d) {
          tooltipActive = false;
          $('.tooltip').css({display: 'none'})
        },
        labels: {
          format: function (v) {
            if (v>0)
              return v + '%';
          }
        },
        colors: metricColors,
        groups: [
            ['data1', 'data2', 'data3']
        ],
        order: null
      },
      bar: {
        width: 18
      },
      axis: {
        rotated: true,
        x: { show: false },
        y: {
          max: 100,
          min: 0,
          tick: {
            values: [0, 50, 100],
            outer: false
          },
          padding: { bottom: 0, top: 0 }
        }
      },
      legend: {
        show: false
      },
      tooltip: { show: false }
    });

    //divider line
    var svg = d3.select('.'+chartName)
      .append('svg')
      .attr('class', 'total-line')
      .append('line')
        .attr('stroke-width', 1)
        .attr('x1', 0)
        .attr('x2', 241);
  }


  function getCountryName(iso3) {
    const result = countryNames.filter(country => country['ISO-alpha3 code'] == iso3);
    return result[0]['M49 Country or Area'];
  }

  function getDatasetCount(iso3) {
    const result = datasetCounts.filter(country => country['ISO3'] == iso3);
    return result[0]['Unique Dataset Count'];
  }


  function initTracking() {
    //initialize mixpanel
    let MIXPANEL_TOKEN = '';
    mixpanel.init(MIXPANEL_TOKEN);
    mixpanel.track('page view', {
      'page title': document.title,
      'page type': 'datavis'
    });
  }

  getData();
  //initTracking();
});