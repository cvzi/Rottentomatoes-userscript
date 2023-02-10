// ==UserScript==
// @name        Show Rottentomatoes meter
// @description Show Rotten Tomatoes score on imdb.com, metacritic.com, letterboxd.com, BoxOfficeMojo, serienjunkies.de, Amazon, Google Play, allmovie.com, Wikipedia, themoviedb.org, movies.com, tvmaze.com, tvguide.com, followshows.com, thetvdb.com, tvnfo.com
// @namespace   cuzi
// @updateURL   https://openuserjs.org/meta/cuzi/Show_Rottentomatoes_meter.meta.js
// @grant       GM_xmlhttpRequest
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       unsafeWindow
// @grant       GM.xmlHttpRequest
// @grant       GM.setValue
// @grant       GM.getValue
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.6.1/jquery.min.js
// @license     GPL-3.0-or-later; https://www.gnu.org/licenses/gpl-3.0.txt
// @icon        https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/72x72/1F345.png
// @version     35
// @connect     www.rottentomatoes.com
// @connect     algolia.net
// @connect     www.flixster.com
// @match       https://www.rottentomatoes.com/
// @match       https://play.google.com/store/movies/details/*
// @match       https://www.amazon.ca/*
// @match       https://www.amazon.co.jp/*
// @match       https://www.amazon.co.uk/*
// @match       https://smile.amazon.co.uk/*
// @match       https://www.amazon.com.au/*
// @match       https://www.amazon.com.mx/*
// @match       https://www.amazon.com/*
// @match       https://smile.amazon.com/*
// @match       https://www.amazon.de/*
// @match       https://smile.amazon.de/*
// @match       https://www.amazon.es/*
// @match       https://www.amazon.fr/*
// @match       https://www.amazon.in/*
// @match       https://www.amazon.it/*
// @match       https://www.imdb.com/title/*
// @match       https://www.serienjunkies.de/*
// @match       https://www.boxofficemojo.com/movies/*
// @match       https://www.boxofficemojo.com/release/*
// @match       https://www.allmovie.com/movie/*
// @match       https://en.wikipedia.org/*
// @match       https://www.fandango.com/*
// @match       https://www.themoviedb.org/movie/*
// @match       https://www.themoviedb.org/tv/*
// @match       https://letterboxd.com/film/*
// @match       https://letterboxd.com/film/*/image*
// @match       https://www.tvmaze.com/shows/*
// @match       https://www.tvguide.com/tvshows/*
// @match       https://followshows.com/show/*
// @match       https://thetvdb.com/series/*
// @match       https://thetvdb.com/movies/*
// @match       https://tvnfo.com/s/*
// @match       https://www.metacritic.com/movie/*
// @match       https://www.metacritic.com/tv/*
// @match       https://www.nme.com/reviews/*
// @match       https://itunes.apple.com/*
// @match       https://epguides.com/*
// @match       https://www.epguides.com/*
// @match       https://sharetv.com/shows/*
// @match       https://www.cc.com/*
// @match       https://www.tvhoard.com/*
// @match       https://www.amc.com/*
// @match       https://www.amcplus.com/*
// @match       https://rlsbb.ru/*/
// @match       https://www.sho.com/*
// @match       https://psa.pm/*
// ==/UserScript==

/* global GM, $, unsafeWindow */

const baseURL = 'https://www.rottentomatoes.com'
const baseURLSearch = baseURL + '/api/private/v2.0/search/?limit=100&q={query}&t={type}'
const baseURLOpenTab = baseURL + '/search/?search={query}'
const algoliaURL = 'https://{domain}-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent={agent}&x-algolia-api-key={sId}&x-algolia-application-id={aId}'
const algoliaAgent = 'Algolia for JavaScript (4.12.0); Browser (lite)'
const flixsterEMSURL = 'https://www.flixster.com/api/ems/v2/emsId/{emsId}'
const cacheExpireAfterHours = 4
const emojiTomato = String.fromCodePoint(0x1F345)
const emojiGreenApple = String.fromCodePoint(0x1F34F)
const emojiStrawberry = String.fromCodePoint(0x1F353)

const emojiPopcorn = '\uD83C\uDF7F'
const emojiGreenSalad = '\uD83E\uDD57'
const emojiNauseated = '\uD83E\uDD22'

function minutesSince (time) {
  const seconds = ((new Date()).getTime() - time.getTime()) / 1000
  return seconds > 60 ? parseInt(seconds / 60) + ' min ago' : 'now'
}
function intersection (setA, setB) {
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
  const _intersection = new Set()
  for (const elem of setB) {
    if (setA.has(elem)) {
      _intersection.add(elem)
    }
  }
  return _intersection
}
const parseLDJSONCache = {}
function parseLDJSON (keys, condition) {
  if (document.querySelector('script[type="application/ld+json"]')) {
    const data = []
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    for (let i = 0; i < scripts.length; i++) {
      let jsonld
      if (scripts[i].innerText in parseLDJSONCache) {
        jsonld = parseLDJSONCache[scripts[i].innerText]
      } else {
        try {
          jsonld = JSON.parse(scripts[i].innerText)
          parseLDJSONCache[scripts[i].innerText] = jsonld
        } catch (e) {
          parseLDJSONCache[scripts[i].innerText] = null
          continue
        }
      }
      if (jsonld) {
        if (Array.isArray(jsonld)) {
          data.push(...jsonld)
        } else {
          data.push(jsonld)
        }
      }
    }
    for (let i = 0; i < data.length; i++) {
      try {
        if (data[i] && data[i] && (typeof condition !== 'function' || condition(data[i]))) {
          if (Array.isArray(keys)) {
            const r = []
            for (let j = 0; j < keys.length; j++) {
              r.push(data[i][keys[j]])
            }
            return r
          } else if (keys) {
            return data[i][keys]
          } else if (typeof condition === 'function') {
            return data[i] // Return whole object
          }
        }
      } catch (e) {
        continue
      }
    }
    return data
  }
  return null
}

function askFlixsterEMS (emsId) {
  return new Promise(function flixsterEMSRequest (resolve) {
    GM.getValue('flixsterEmsCache', '{}').then(function (s) {
      const flixsterEmsCache = JSON.parse(s)

      // Delete algoliaCached values, that are expired
      for (const prop in flixsterEmsCache) {
        if ((new Date()).getTime() - (new Date(flixsterEmsCache[prop].time)).getTime() > cacheExpireAfterHours * 60 * 60 * 1000) {
          delete flixsterEmsCache[prop]
        }
      }

      // Check cache or request new content
      if (emsId in flixsterEmsCache) {
        return resolve(flixsterEmsCache[emsId])
      }
      const url = flixsterEMSURL.replace('{emsId}', encodeURIComponent(emsId))
      GM.xmlHttpRequest({
        method: 'GET',
        url: url,
        onload: function (response) {
          let data = null
          try {
            data = JSON.parse(response.responseText)
          } catch (e) {
            console.error('Rottentomatoes flixster ems JSON Error\nURL: ' + url)
            console.error(e)
            data = {}
          }

          // Save to flixsterEmsCache
          data.time = (new Date()).toJSON()

          flixsterEmsCache[emsId] = data

          GM.setValue('flixsterEmsCache', JSON.stringify(flixsterEmsCache))

          resolve(data)
        },
        onerror: function (response) {
          console.error('Rottentomatoes flixster ems GM.xmlHttpRequest Error: ' + response.status + '\nURL: ' + url + '\nResponse:\n' + response.responseText)
          resolve(null)
        }
      })
    })
  })
}
async function addFlixsterEMS (orgData) {
  const flixsterData = await askFlixsterEMS(orgData.emsId)
  if (!flixsterData || !('tomatometer' in flixsterData)) {
    return orgData
  }
  if ('certifiedFresh' in flixsterData.tomatometer && flixsterData.tomatometer.certifiedFresh) {
    orgData.meterClass = 'certified_fresh'
  }
  if ('numReviews' in flixsterData.tomatometer && flixsterData.tomatometer.numReviews) {
    orgData.numReviews = flixsterData.tomatometer.numReviews
  }
  if ('consensus' in flixsterData.tomatometer && flixsterData.tomatometer.consensus) {
    orgData.consensus = flixsterData.tomatometer.consensus
  }
  if ('userRatingSummary' in flixsterData) {
    if ('scoresCount' in flixsterData.userRatingSummary && flixsterData.userRatingSummary.scoresCount) {
      orgData.audienceCount = flixsterData.userRatingSummary.scoresCount
    } else if ('dtlScoreCount' in flixsterData.userRatingSummary && flixsterData.userRatingSummary.dtlScoreCount) {
      orgData.audienceCount = flixsterData.userRatingSummary.dtlScoreCount
    }
    if ('wtsCount' in flixsterData.userRatingSummary && flixsterData.userRatingSummary.wtsCount) {
      orgData.audienceWantToSee = flixsterData.userRatingSummary.wtsCount
    } else if ('dtlWtsCount' in flixsterData.userRatingSummary && flixsterData.userRatingSummary.dtlWtsCount) {
      orgData.audienceWantToSee = flixsterData.userRatingSummary.dtlWtsCount
    }
    if ('reviewCount' in flixsterData.userRatingSummary && flixsterData.userRatingSummary.reviewCount) {
      orgData.audienceReviewCount = flixsterData.userRatingSummary.reviewCount
    }
    if ('avgScore' in flixsterData.userRatingSummary && flixsterData.userRatingSummary.avgScore) {
      orgData.audienceAvgScore = flixsterData.userRatingSummary.avgScore
    }
  }
  return orgData
}

function updateAlgolia () {
  // Get algolia data from https://www.rottentomatoes.com/
  const algoliaSearch = { aId: null, sId: null }
  if (unsafeWindow.RottenTomatoes && 'thirdParty' in unsafeWindow.RottenTomatoes && 'algoliaSearch' in unsafeWindow.RottenTomatoes.thirdParty) {
    if (typeof (unsafeWindow.RottenTomatoes.thirdParty.algoliaSearch.aId) === 'string' && typeof (unsafeWindow.RottenTomatoes.thirdParty.algoliaSearch.sId) === 'string') {
      algoliaSearch.aId = unsafeWindow.RottenTomatoes.thirdParty.algoliaSearch.aId // x-algolia-application-id
      algoliaSearch.sId = unsafeWindow.RottenTomatoes.thirdParty.algoliaSearch.sId // x-algolia-api-key
    }
  }
  // Always store even if null to hide the "You need to visit www.rottentomatoes.com at least once to enable audience score" warning
  GM.setValue('algoliaSearch', JSON.stringify(algoliaSearch)).then(function () {
    console.debug('Updated algoliaSearch: ' + JSON.stringify(algoliaSearch))
  })
}

function meterBar (data) {
  // Create the "progress" bar with the meter score
  let barColor = 'grey'
  let bgColor = '#ECE4B5'
  let color = 'black'
  let width = 0
  let textInside = ''
  let textAfter = ''

  if (data.meterClass === 'certified_fresh') {
    barColor = '#C91B22'
    color = 'yellow'
    textInside = emojiStrawberry + ' ' + data.meterScore.toLocaleString() + '%'
    width = data.meterScore || 0
  } else if (data.meterClass === 'fresh') {
    barColor = '#C91B22'
    color = 'white'
    textInside = emojiTomato + ' ' + data.meterScore.toLocaleString() + '%'
    width = data.meterScore || 0
  } else if (data.meterClass === 'rotten') {
    color = 'gray'
    barColor = '#94B13C'
    if (data.meterScore && data.meterScore > 30) {
      textAfter = data.meterScore.toLocaleString() + '% '
      textInside = '<span style="font-size:13px">' + emojiGreenApple + '</span>'
    } else {
      textAfter = data.meterScore.toLocaleString() + '% <span style="font-size:13px">' + emojiGreenApple + '</span>'
    }
    width = data.meterScore || 0
  } else {
    bgColor = barColor = '#787878'
    color = 'silver'
    textInside = 'N/A'
    width = 100
  }

  let title = 'Critics ' + (typeof data.meterScore === 'number' ? data.meterScore.toLocaleString() : 'N/A') + '% ' + data.meterClass
  if ('numReviews' in data && typeof data.numReviews === 'number') {
    title += ' ' + data.numReviews.toLocaleString() + ' reviews'
  }
  if ('consensus' in data) {
    const node = document.createElement('span')
    node.innerHTML = data.consensus
    title += '\n' + node.textContent
  }
  return '<div title="' + title + '" style="cursor:help; margin-top:1px; width:100px; overflow: hidden;height: 20px;background-color: ' + bgColor + ';color: ' + color + ';text-align:center; border-radius: 4px;box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);">' +
    '<div style="width:' + width + '%; background-color: ' + barColor + '; color: ' + color + '; font-size:14px; font-weight:bold; text-align:center; float:left; height: 100%;line-height: 20px;box-shadow: inset 0 -1px 0 rgba(0,0,0,0.15);transition: width 0.6s ease;">' + textInside + '</div>' + textAfter + '</div>'
}
function audienceBar (data) {
  // Create the "progress" bar with the audience score
  if (!('audienceScore' in data) || data.audienceScore === null) {
    return ''
  }

  let barColor = 'grey'
  let bgColor = '#ECE4B5'
  let color = 'black'
  let width = 0
  let textInside = ''
  let textAfter = ''

  if (data.audienceClass === 'red_popcorn') {
    barColor = '#C91B22'
    color = data.audienceScore > 94 ? 'yellow' : 'white'
    textInside = emojiPopcorn + ' ' + data.audienceScore.toLocaleString() + '%'
    width = data.audienceScore
  } else if (data.audienceClass === 'green_popcorn') {
    color = 'gray'
    barColor = '#94B13C'
    if (data.audienceScore > 30) {
      textAfter = data.audienceScore.toLocaleString() + '% '
      textInside = '<span style="font-size:13px">' + emojiGreenSalad + '</span>'
    } else {
      textAfter = data.audienceScore.toLocaleString() + '% <span style="font-size:13px">' + emojiNauseated + '</span>'
    }
    width = data.audienceScore
  } else {
    bgColor = barColor = '#787878'
    color = 'silver'
    textInside = 'N/A'
    width = 100
  }

  let title = 'Audience ' + (typeof data.audienceScore === 'number' ? data.audienceScore.toLocaleString() : 'N/A') + '% ' + data.audienceClass
  const titleLine2 = []
  if ('audienceCount' in data && typeof data.audienceCount === 'number') {
    titleLine2.push(data.audienceCount.toLocaleString() + ' Votes')
  }
  if ('audienceReviewCount' in data) {
    titleLine2.push(data.audienceReviewCount.toLocaleString() + ' Reviews')
  }
  if ('audienceAvgScore' in data && typeof data.audienceAvgScore === 'number') {
    titleLine2.push('Average score: ' + data.audienceAvgScore.toLocaleString() + ' / 5 stars')
  }
  if ('audienceWantToSee' in data && typeof data.audienceWantToSee === 'number') {
    titleLine2.push(data.audienceWantToSee.toLocaleString() + ' want to see')
  }

  title = title + (titleLine2 ? ('\n' + titleLine2.join('\n')) : '')
  return '<div title="' + title + '" style="cursor:help; margin-top:1px; width:100px; overflow: hidden;height: 20px;background-color: ' + bgColor + ';color: ' + color + ';text-align:center; border-radius: 4px;box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);">' +
    '<div style="width:' + width + '%; background-color: ' + barColor + '; color: ' + color + '; font-size:14px; font-weight:bold; text-align:center; float:left; height: 100%;line-height: 20px;box-shadow: inset 0 -1px 0 rgba(0,0,0,0.15);transition: width 0.6s ease;">' + textInside + '</div>' + textAfter + '</div>'
}

const current = {
  type: null,
  query: null,
  year: null
}

async function loadMeter (query, type, year) {
  // Load data from rotten tomatoes search API or from cache

  current.type = type
  current.query = query
  current.year = year

  const rottenType = type === 'movie' ? 'movie' : 'tvSeries'

  const url = baseURLSearch.replace('{query}', encodeURIComponent(query)).replace('{type}', encodeURIComponent(rottenType))

  const cache = JSON.parse(await GM.getValue('cache', '{}'))

  // Delete cached values, that are expired
  for (const prop in cache) {
    if ((new Date()).getTime() - (new Date(cache[prop].time)).getTime() > cacheExpireAfterHours * 60 * 60 * 1000) {
      delete cache[prop]
    }
  }

  const algoliaCache = JSON.parse(await GM.getValue('algoliaCache', '{}'))

  // Delete algoliaCached values, that are expired
  for (const prop in algoliaCache) {
    if ((new Date()).getTime() - (new Date(algoliaCache[prop].time)).getTime() > cacheExpireAfterHours * 60 * 60 * 1000) {
      delete algoliaCache[prop]
    }
  }

  const algoliaSearch = JSON.parse(await GM.getValue('algoliaSearch', '{}'))

  // Check cache or request new content
  if (query in algoliaCache) {
    // Use cached response
    console.debug('Use cached algolia response')
    handleAlgoliaResponse(algoliaCache[query])
  } else if ('aId' in algoliaSearch && 'sId' in algoliaSearch) {
    // Use algolia.net API
    const url = algoliaURL.replace('{domain}', algoliaSearch.aId.toLowerCase()).replace('{aId}', encodeURIComponent(algoliaSearch.aId)).replace('{sId}', encodeURIComponent(algoliaSearch.sId)).replace('{agent}', encodeURIComponent(algoliaAgent))
    GM.xmlHttpRequest({
      method: 'POST',
      url: url,
      data: '{"requests":[{"indexName":"content_rt","query":"' + query.replace('"', '') + '","params":"filters=rtId%20%3E%200%20AND%20isEmsSearchable%20%3D%201&hitsPerPage=20"}]}',
      onload: function (response) {
        // Save to algoliaCache
        response.time = (new Date()).toJSON()

        // Chrome fix: Otherwise JSON.stringify(cache) omits responseText
        const newobj = {}
        for (const key in response) {
          newobj[key] = response[key]
        }
        newobj.responseText = response.responseText

        algoliaCache[query] = newobj

        GM.setValue('algoliaCache', JSON.stringify(algoliaCache))

        handleAlgoliaResponse(response)
      },
      onerror: function (response) {
        console.error('Rottentomatoes algoliaSearch GM.xmlHttpRequest Error: ' + response.status + '\nURL: ' + url + '\nResponse:\n' + response.responseText)
      }
    })
  } else if (url in cache) {
    // Use cached legacy response
    console.debug('Use cached legacy response')
    handleResponse(cache[url])
  } else {
    console.debug('algoliaSearch not configured, falling back to legacy API: ' + url)
    GM.xmlHttpRequest({
      method: 'GET',
      url: url,
      onload: function (response) {
        // Save to cache

        response.time = (new Date()).toJSON()

        // Chrome fix: Otherwise JSON.stringify(cache) omits responseText
        const newobj = {}
        for (const key in response) {
          newobj[key] = response[key]
        }
        newobj.responseText = response.responseText

        cache[url] = newobj

        GM.setValue('cache', JSON.stringify(cache))

        handleResponse(response)
      },
      onerror: function (response) {
        console.error('Rottentomatoes legacy API GM.xmlHttpRequest Error: ' + response.status + '\nURL: ' + url + '\nResponse:\n' + response.responseText)
      }
    })
  }
}

function matchQuality (title, year, currentSet) {
  if (title === current.query && year === current.year) {
    return 104 + year
  }
  if (title.toLowerCase() === current.query.toLowerCase() && year === current.year) {
    return 103 + year
  }
  if (title === current.query && current.year) {
    return 102 - Math.abs(year - current.year)
  }
  if (title.toLowerCase() === current.query.toLowerCase() && current.year) {
    return 101 - Math.abs(year - current.year)
  }
  if (title.replace(/\(.+\)/, '').trim() === current.query && current.year) {
    return 100 - Math.abs(year - current.year)
  }
  if (title === current.query) {
    return 8
  }
  if (title.replace(/\(.+\)/, '').trim() === current.query) {
    return 7
  }
  if (title.startsWith(current.query)) {
    return 6
  }
  if (current.query.indexOf(title) !== -1) {
    return 5
  }
  if (title.indexOf(current.query) !== -1) {
    return 4
  }
  if (current.query.toLowerCase().indexOf(title.toLowerCase()) !== -1) {
    return 3
  }
  if (title.toLowerCase().indexOf(current.query.toLowerCase()) !== -1) {
    return 2
  }
  const titleSet = new Set(title.replace(/[^a-z ]/gi, ' ').split(' '))
  const score = intersection(titleSet, currentSet).size - 20
  if (year === current.year) {
    return score + 1
  }
  return score
}

function handleResponse (response) {
  // Handle GM.xmlHttpRequest response from legacy API https://www.rottentomatoes.com/api/private/v2.0/search/?limit=100&q={query}&t={type}

  const data = JSON.parse(response.responseText)

  // Adapt type name from original metacritic type to rotten tomatoes type
  let prop
  if (current.type === 'movie') {
    prop = 'movies'
  } else {
    prop = 'tvSeries'
    // Align series info with movie info
    for (let i = 0; i < data[prop].length; i++) {
      data[prop][i].name = data[prop][i].title
      data[prop][i].year = data[prop][i].startYear
    }
  }

  if (data[prop] && data[prop].length) {
    // Sort results by closest match
    const currentSet = new Set(current.query.replace(/[^a-z ]/gi, ' ').split(' '))
    data[prop].sort(function (a, b) {
      if (!Object.prototype.hasOwnProperty.call(a, 'matchQuality')) {
        a.matchQuality = matchQuality(a.name, a.year, currentSet)
      }
      if (!Object.prototype.hasOwnProperty.call(b, 'matchQuality')) {
        b.matchQuality = matchQuality(b.name, b.year, currentSet)
      }

      return b.matchQuality - a.matchQuality
    })
    data[prop][0].legacy = 1
    showMeter(data[prop], new Date(response.time))
  } else {
    console.debug('Rottentomatoes: No results for ' + current.query)
  }
}

async function handleAlgoliaResponse (response) {
  // Handle GM.xmlHttpRequest response
  const rawData = JSON.parse(response.responseText)

  // Filter according to type
  const hits = rawData.results[0].hits.filter(hit => hit.type === current.type)

  // Change to same data structure as legacy API
  const arr = []

  hits.forEach(function (hit) {
    const result = {
      name: hit.title,
      year: parseInt(hit.releaseYear),
      url: '/' + (current.type === 'tv' ? 'tv' : 'm') + '/' + ('vanity' in hit ? hit.vanity : hit.title.toLowerCase()),
      meterClass: null,
      meterScore: null,
      audienceClass: null,
      audienceScore: null,
      emsId: hit.emsId
    }
    if ('rottenTomatoes' in hit) {
      if ('criticsIconUrl' in hit.rottenTomatoes) {
        result.meterClass = hit.rottenTomatoes.criticsIconUrl.match(/\/(\w+)\.png/)[1]
      }
      if ('criticsScore' in hit.rottenTomatoes) {
        result.meterScore = hit.rottenTomatoes.criticsScore
      }
      if ('audienceIconUrl' in hit.rottenTomatoes) {
        result.audienceClass = hit.rottenTomatoes.audienceIconUrl.match(/\/(\w+)\.png/)[1]
      }
      if ('audienceScore' in hit.rottenTomatoes) {
        result.audienceScore = hit.rottenTomatoes.audienceScore
      }
      if ('certifiedFresh' in hit.rottenTomatoes && hit.rottenTomatoes.certifiedFresh) {
        result.meterClass = 'certified_fresh'
      }
    }
    arr.push(result)
  })

  // Sort results by closest match
  const currentSet = new Set(current.query.replace(/[^a-z ]/gi, ' ').split(' '))
  arr.sort(function (a, b) {
    if (!Object.prototype.hasOwnProperty.call(a, 'matchQuality')) {
      a.matchQuality = matchQuality(a.name, a.year, currentSet)
    }
    if (!Object.prototype.hasOwnProperty.call(b, 'matchQuality')) {
      b.matchQuality = matchQuality(b.name, b.year, currentSet)
    }

    return b.matchQuality - a.matchQuality
  })

  if (arr.length > 0 && arr[0].meterScore && arr[0].meterScore >= 70 && arr[0].meterClass !== 'certified_fresh') {
    // Get more details for first result
    arr[0] = await addFlixsterEMS(arr[0])
  }

  if (arr) {
    showMeter(arr, new Date(response.time))
  } else {
    console.debug('Rottentomatoes: No results for ' + current.query)
  }
}

function showMeter (arr, time) {
  // Show a small box in the right lower corner
  $('#mcdiv321rotten').remove()
  let main, div
  div = main = $('<div id="mcdiv321rotten"></div>').appendTo(document.body)
  div.css({
    position: 'fixed',
    bottom: 0,
    right: 0,
    minWidth: 100,
    maxWidth: 400,
    maxHeight: '95%',
    overflow: 'auto',
    backgroundColor: '#fff',
    border: '2px solid #bbb',
    borderRadius: ' 6px',
    boxShadow: '0 0 3px 3px rgba(100, 100, 100, 0.2)',
    color: '#000',
    padding: ' 3px',
    zIndex: '5010001',
    fontFamily: 'Helvetica,Arial,sans-serif'
  })

  // First result
  $('<div class="firstResult"><a style="font-size:small; color:#136CB2; " href="' + baseURL + arr[0].url + '">' + arr[0].name + ' (' + arr[0].year + ')</a>' + meterBar(arr[0]) + audienceBar(arr[0]) + '</div>').appendTo(main)

  // Shall the following results be collapsed by default?
  if ((arr.length > 1 && arr[0].matchQuality > 10) || arr.length > 10) {
    $('<span style="color:gray;font-size: x-small">More results...</span>').appendTo(main).click(function () { more.css('display', 'block'); this.parentNode.removeChild(this) })
    const more = div = $('<div style="display:none"></div>').appendTo(main)
  }

  if (arr.length > 0 && 'legacy' in arr[0] && arr[0].legacy === 1) {
    $('<div>You need to visit <a href="https://www.rottentomatoes.com/">www.rottentomatoes.com</a> at least once to enable audience score.</div>').appendTo(main)
  }

  // More results
  for (let i = 1; i < arr.length; i++) {
    $('<div><a style="font-size:small; color:#136CB2; " href="' + baseURL + arr[i].url + '">' + arr[i].name + ' (' + arr[i].year + ')</a>' + meterBar(arr[i]) + audienceBar(arr[i]) + '</div>').appendTo(div)
  }

  // Footer
  const sub = $('<div></div>').appendTo(main)
  $('<time style="color:#b6b6b6; font-size: 11px;" datetime="' + time + '" title="' + time.toLocaleTimeString() + ' ' + time.toLocaleDateString() + '">' + minutesSince(time) + '</time>').appendTo(sub)
  $('<a style="color:#b6b6b6; font-size: 11px;" target="_blank" href="' + baseURLOpenTab.replace('{query}', encodeURIComponent(current.query)) + '" title="Open Rotten Tomatoes">@rottentomatoes.com</a>').appendTo(sub)
  $('<span title="Hide me" style="cursor:pointer; float:right; color:#b6b6b6; font-size: 11px; padding-left:5px;padding-top:3px">&#10062;</span>').appendTo(sub).click(function () {
    document.body.removeChild(this.parentNode.parentNode)
  })
}

const Always = () => true
const sites = {
  googleplay: {
    host: ['play.google.com'],
    condition: Always,
    products: [
      {
        condition: () => ~document.location.href.indexOf('/movies/details/'),
        type: 'movie',
        data: () => document.querySelector('*[itemprop=name]').textContent
      }
    ]
  },
  imdb: {
    host: ['imdb.com'],
    condition: () => !~document.location.pathname.indexOf('/mediaviewer') && !~document.location.pathname.indexOf('/mediaindex') && !~document.location.pathname.indexOf('/videoplayer'),
    products: [
      {
        condition: function () {
          const e = document.querySelector("meta[property='og:type']")
          if (e && e.content === 'video.movie') {
            return true
          } else if (document.querySelector('[data-testid="hero-title-block__title"]') && !document.querySelector('[data-testid="hero-subnav-bar-left-block"] a[href*="episodes/"]')) {
          // New design 2020-12
            return true
          }
          return false
        },
        type: 'movie',
        data: function () {
          let year = null
          let name = null
          let jsonld = null
          if (document.querySelector('[data-testid="hero-title-block__title"]')) {
          // New design 2020-12
            const m = document.title.match(/\s+\((\d{4})\)/)
            if (m) {
              year = parseInt(m[1])
            }
            return [document.querySelector('[data-testid="hero-title-block__title"]').textContent, year]
          }
          if (document.querySelector('#titleYear')) {
            year = parseInt(document.querySelector('#titleYear a').firstChild.textContent)
          }
          if (document.querySelector("meta[property='og:title']") && document.querySelector("meta[property='og:title']").content) { // English title, this is the prefered title for Rottentomatoes' search
            name = document.querySelector("meta[property='og:title']").content.trim()
            if (name.indexOf('- IMDb') !== -1) {
              name = name.replace('- IMDb', '').trim()
            }
            name = name.replace(/\(\d{4}\)/, '').trim()
          }
          if (document.querySelector('script[type="application/ld+json"]')) { // Original title and release year
            jsonld = parseLDJSON(['name', 'datePublished'])
            if (name === null) { name = jsonld[0] }
            if (year === null) { year = parseInt(jsonld[1].match(/\d{4}/)[0]) }
          }
          if (name !== null && year !== null) {
            return [name, year] // Use original title
          }
          if (document.querySelector('.originalTitle') && document.querySelector('.title_wrapper h1')) {
            return [document.querySelector('.title_wrapper h1').firstChild.textContent.trim(), year] // Use localized title
          } else if (document.querySelector('h1[itemprop=name]')) { // Movie homepage (New design 2015-12)
            return [document.querySelector('h1[itemprop=name]').firstChild.textContent.trim(), year]
          } else if (document.querySelector('*[itemprop=name] a') && document.querySelector('*[itemprop=name] a').firstChild.textContent) { // Subpage of a move
            return [document.querySelector('*[itemprop=name] a').firstChild.textContent.trim(), year]
          } else if (document.querySelector('.title-extra[itemprop=name]')) { // Movie homepage: sub-/alternative-/original title
            return [document.querySelector('.title-extra[itemprop=name]').firstChild.textContent.replace(/"/g, '').trim(), year]
          } else if (document.querySelector('*[itemprop=name]')) { // Movie homepage (old design)
            return document.querySelector('*[itemprop=name]').firstChild.textContent.trim()
          } else {
            const rm = document.title.match(/(.+?)\s+(\(\d+\))? - IMDb/)
            return [rm[1], rm[2]]
          }
        }
      },
      {
        condition: function () {
          const e = document.querySelector("meta[property='og:type']")
          if (e && e.content === 'video.tv_show') {
            return true
          } else if (document.querySelector('[data-testid="hero-subnav-bar-left-block"] a[href*="episodes/"]')) {
          // New design 2020-12
            return true
          }
          return false
        },
        type: 'tv',
        data: function () {
          let year = null
          if (document.querySelector('[data-testid="hero-title-block__title"]')) {
          // New design 2020-12
            const m = document.title.match(/\s(\d{4})(\S\d{4}?)?/)
            if (m) {
              year = parseInt(m[1])
            }
            return [document.querySelector('[data-testid="hero-title-block__title"]').textContent, year]
          } else if (document.querySelector('*[itemprop=name]')) {
            const m = document.title.match(/\s(\d{4})(\S\d{4}?)?/)
            if (m) {
              year = parseInt(m[1])
            }
            return [document.querySelector('*[itemprop=name]').textContent, year]
          } else if (document.querySelector('script[type="application/ld+json"]')) {
            const jsonld = JSON.parse(document.querySelector('script[type="application/ld+json"]').innerText)
            try {
              year = parseInt(jsonld.datePublished.match(/\d{4}/)[0])
            } catch (e) {}
            return [jsonld.name, year]
          } else {
            return [document.title.match(/(.+?)\s+\(TV/)[1], year]
          }
        }
      }
    ]
  },
  'tv.com': {
    host: ['www.tv.com'],
    condition: () => document.querySelector("meta[property='og:type']"),
    products: [{
      condition: () => document.querySelector("meta[property='og:type']").content === 'tv_show' && document.querySelector('h1[data-name]'),
      type: 'tv',
      data: () => document.querySelector('h1[data-name]').dataset.name
    }]
  },
  metacritic: {
    host: ['www.metacritic.com'],
    condition: () => document.querySelector("meta[property='og:type']"),
    products: [{
      condition: () => document.querySelector("meta[property='og:type']").content === 'video.movie',
      type: 'movie',
      data: function () {
        let year = null
        if (document.querySelector('.release_year')) {
          year = parseInt(document.querySelector('.release_year').firstChild.textContent)
        } else if (document.querySelector('.release_data .data')) {
          year = document.querySelector('.release_data .data').textContent.match(/(\d{4})/)[1]
        }

        return [document.querySelector("meta[property='og:title']").content, year]
      }
    },
    {
      condition: () => document.querySelector("meta[property='og:type']").content === 'video.tv_show',
      type: 'tv',
      data: function () {
        let title = document.querySelector("meta[property='og:title']").content
        let year = null
        if (title.match(/\s\(\d{4}\)$/)) {
          year = parseInt(title.match(/\s\((\d{4})\)$/)[1])
          title = title.replace(/\s\(\d{4}\)$/, '') // Remove year
        } else if (document.querySelector('.release_date')) {
          year = document.querySelector('.release_date').textContent.match(/(\d{4})/)[1]
        }

        return [title, year]
      }
    }
    ]
  },
  serienjunkies: {
    host: ['www.serienjunkies.de'],
    condition: Always,
    products: [{
      condition: () => Always,
      type: 'tv',
      data: () => parseLDJSON('name', (j) => (j['@type'] === 'TVSeries'))
    }]
  },
  amazon: {
    host: ['amazon.'],
    condition: Always,
    products: [
      {
        condition: () => (document.querySelector('[data-automation-id=title]') && (document.getElementsByClassName('av-season-single').length || document.querySelector('[data-automation-id="num-of-seasons-badge"]'))),
        type: 'tv',
        data: () => document.querySelector('[data-automation-id=title]').textContent.trim()
      },
      {
        condition: () => document.querySelector('[data-automation-id=title]'),
        type: 'movie',
        data: () => document.querySelector('[data-automation-id=title]').textContent.trim().replace(/\[.{1,8}\]/, '')
      }
    ]
  },
  BoxOfficeMojo: {
    host: ['boxofficemojo.com'],
    condition: () => Always,
    products: [
      {
        condition: () => document.location.pathname.startsWith('/release/'),
        type: 'movie',
        data: function () {
          let year = null
          const cells = document.querySelectorAll('#body .mojo-summary-values .a-section span')
          for (let i = 0; i < cells.length; i++) {
            if (~cells[i].innerText.indexOf('Release Date')) {
              year = parseInt(cells[i].nextElementSibling.textContent.match(/\d{4}/)[0])
              break
            }
          }
          return [document.querySelector('meta[name=title]').content, year]
        }
      },
      {
        condition: () => ~document.location.search.indexOf('id=') && document.querySelector('#body table:nth-child(2) tr:first-child b'),
        type: 'movie',
        data: function () {
          let year = null
          try {
            const tds = document.querySelectorAll('#body table:nth-child(2) tr:first-child table table table td')
            for (let i = 0; i < tds.length; i++) {
              if (~tds[i].innerText.indexOf('Release Date')) {
                year = parseInt(tds[i].innerText.match(/\d{4}/)[0])
                break
              }
            }
          } catch (e) { }
          return [document.querySelector('#body table:nth-child(2) tr:first-child b').firstChild.textContent, year]
        }
      }]
  },
  AllMovie: {
    host: ['allmovie.com'],
    condition: () => document.querySelector('h2[itemprop=name].movie-title'),
    products: [{
      condition: () => document.querySelector('h2[itemprop=name].movie-title'),
      type: 'movie',
      data: () => document.querySelector('h2[itemprop=name].movie-title').firstChild.textContent.trim()
    }]
  },
  'en.wikipedia': {
    host: ['en.wikipedia.org'],
    condition: Always,
    products: [{
      condition: function () {
        if (!document.querySelector('.infobox .summary')) {
          return false
        }
        const r = /\d\d\d\d films/
        return $('#catlinks a').filter((i, e) => e.firstChild.textContent.match(r)).length
      },
      type: 'movie',
      data: () => document.querySelector('.infobox .summary').firstChild.textContent
    },
    {
      condition: function () {
        if (!document.querySelector('.infobox .summary')) {
          return false
        }
        const r = /television series/
        return $('#catlinks a').filter((i, e) => e.firstChild.textContent.match(r)).length
      },
      type: 'tv',
      data: () => document.querySelector('.infobox .summary').firstChild.textContent
    }]
  },
  fandango: {
    host: ['fandango.com'],
    condition: () => document.querySelector("meta[property='og:title']"),
    products: [{
      condition: Always,
      type: 'movie',
      data: () => document.querySelector("meta[property='og:title']").content.match(/(.+?)\s+\(\d{4}\)/)[1].trim()
    }]
  },
  themoviedb: {
    host: ['themoviedb.org'],
    condition: () => document.querySelector("meta[property='og:type']"),
    products: [{
      condition: () => document.querySelector("meta[property='og:type']").content === 'movie',
      type: 'movie',
      data: function () {
        let year = null
        try {
          year = parseInt(document.querySelector('.release_date').innerText.match(/\d{4}/)[0])
        } catch (e) {}

        return [document.querySelector("meta[property='og:title']").content, year]
      }
    },
    {
      condition: () => document.querySelector("meta[property='og:type']").content === 'tv' || document.querySelector("meta[property='og:type']").content === 'tv_series',
      type: 'tv',
      data: () => document.querySelector("meta[property='og:title']").content
    }]
  },
  letterboxd: {
    host: ['letterboxd.com'],
    condition: () => unsafeWindow.filmData && 'name' in unsafeWindow.filmData,
    products: [{
      condition: Always,
      type: 'movie',
      data: () => [unsafeWindow.filmData.name, unsafeWindow.filmData.releaseYear]
    }]
  },
  TVmaze: {
    host: ['tvmaze.com'],
    condition: () => document.querySelector('h1'),
    products: [{
      condition: Always,
      type: 'tv',
      data: () => document.querySelector('h1').firstChild.textContent
    }]
  },
  TVGuide: {
    host: ['tvguide.com'],
    condition: Always,
    products: [{
      condition: () => document.location.pathname.startsWith('/tvshows/'),
      type: 'tv',
      data: function () {
        if (document.querySelector('meta[itemprop=name]')) {
          return document.querySelector('meta[itemprop=name]').content
        } else {
          return document.querySelector("meta[property='og:title']").content.split('|')[0]
        }
      }
    }]
  },
  followshows: {
    host: ['followshows.com'],
    condition: Always,
    products: [{
      condition: () => document.querySelector("meta[property='og:type']").content === 'video.tv_show',
      type: 'tv',
      data: () => document.querySelector("meta[property='og:title']").content
    }]
  },
  TheTVDB: {
    host: ['thetvdb.com'],
    condition: Always,
    products: [{
      condition: () => document.location.pathname.startsWith('/series/'),
      type: 'tv',
      data: () => document.getElementById('series_title').firstChild.textContent.trim()
    },
    {
      condition: () => document.location.pathname.startsWith('/movies/'),
      type: 'movie',
      data: () => document.getElementById('series_title').firstChild.textContent.trim()
    }]
  },
  TVNfo: {
    host: ['tvnfo.com'],
    condition: () => document.querySelector('.ui.breadcrumb a[href*="/series"]'),
    products: [{
      condition: Always,
      type: 'tv',
      data: function () {
        const years = document.querySelector('#title h1 .years').textContent.trim()
        const title = document.querySelector('#title h1').textContent.replace(years, '').trim()
        let year = null
        if (years) {
          try {
            year = years.match(/\d{4}/)[0]
          } catch (e) {}
        }
        return [title, year]
      }
    }]
  },
  nme: {
    host: ['nme.com'],
    condition: () => document.location.pathname.startsWith('/reviews/'),
    products: [{
      condition: () => document.querySelector('.tdb-breadcrumbs a[href*="/reviews/film-reviews"]'),
      type: 'movie',
      data: function () {
        let year = null
        try {
          year = parseInt(document.querySelector('*[itemprop=datePublished]').content.match(/\d{4}/)[0])
        } catch (e) {}

        try {
          return [document.title.match(/[‘'](.+?)[’']/)[1], year]
        } catch (e) {
          try {
            return [document.querySelector('h1.tdb-title-text').textContent.match(/[‘'](.+?)[’']/)[1], year]
          } catch (e) {
            return [document.querySelector('h1').textContent.match(/:\s*(.+)/)[1].trim(), year]
          }
        }
      }
    },
    {
      condition: () => document.querySelector('.tdb-breadcrumbs a[href*="/reviews/tv-reviews"]'),
      type: 'tv',
      data: () => document.querySelector('h1.tdb-title-text').textContent.match(/‘(.+?)’/)[1]
    }]
  },
  itunes: {
    host: ['itunes.apple.com'],
    condition: Always,
    products: [{
      condition: () => ~document.location.href.indexOf('/movie/'),
      type: 'movie',
      data: () => parseLDJSON('name', (j) => (j['@type'] === 'Movie'))
    },
    {
      condition: () => ~document.location.href.indexOf('/tv-season/'),
      type: 'tv',
      data: function () {
        let name = parseLDJSON('name', (j) => (j['@type'] === 'TVSeries'))
        if (~name.indexOf(', Season')) {
          name = name.split(', Season')[0]
        }
        return name
      }
    }]
  },
  epguides: {
    host: ['epguides.com'],
    condition: () => document.getElementById('eplist'),
    products: [{
      condition: () => document.getElementById('eplist') && document.querySelector('.center.titleblock h2'),
      type: 'tv',
      data: () => document.querySelector('.center.titleblock h2').textContent.trim()
    }]
  },
  ShareTV: {
    host: ['sharetv.com'],
    condition: () => document.location.pathname.startsWith('/shows/'),
    products: [{
      condition: () => document.location.pathname.split('/').length === 3 && document.querySelector("meta[property='og:title']"),
      type: 'tv',
      data: () => document.querySelector("meta[property='og:title']").content
    }]
  },
  ComedyCentral: {
    host: ['cc.com'],
    condition: () => document.location.pathname.startsWith('/shows/'),
    products: [{
      condition: () => document.location.pathname.split('/').length === 3 && document.querySelector("meta[property='og:title']"),
      type: 'tv',
      data: () => document.querySelector("meta[property='og:title']").content.replace('| Comedy Central', '').trim()
    },
    {
      condition: () => document.location.pathname.split('/').length === 3 && document.title.match(/(.+?)\s+-\s+Series/),
      type: 'tv',
      data: () => document.title.match(/(.+?)\s+-\s+Series/)[1]
    }]
  },
  TVHoard: {
    host: ['tvhoard.com'],
    condition: Always,
    products: [{
      condition: () => document.location.pathname.split('/').length === 3 && document.location.pathname.split('/')[1] === 'titles' && !document.querySelector('app-root title-secondary-details-panel .seasons') && document.querySelector('app-root title-page-container h1.title a'),
      type: 'movie',
      data: () => [document.querySelector('app-root title-page-container h1.title a').textContent.trim(), document.querySelector('app-root title-page-container title-primary-details-panel h1.title .year').textContent.trim().substring(1, 5)]
    },
    {
      condition: () => document.location.pathname.split('/').length === 3 && document.location.pathname.split('/')[1] === 'titles' && document.querySelector('app-root title-secondary-details-panel .seasons') && document.querySelector('app-root title-page-container h1.title a'),
      type: 'tv',
      data: () => document.querySelector('app-root title-page-container h1.title a').textContent.trim()
    }]
  },
  AMC: {
    host: ['amc.com'],
    condition: () => document.location.pathname.startsWith('/shows/'),
    products: [
      {
        condition: () => document.location.pathname.split('/').length === 3 && document.querySelector("meta[property='og:type']") && document.querySelector("meta[property='og:type']").content.indexOf('tv_show') !== -1,
        type: 'tv',
        data: () => document.querySelector('.video-card-description h1').textContent.trim()
      }]
  },
  AMCplus: {
    host: ['amcplus.com'],
    condition: () => Always,
    products: [
      {
        condition: () => document.title.match(/Watch .+? |/),
        type: 'tv',
        data: () => document.title.match(/Watch (.+?) |/)[1].trim()
      }]
  },
  RlsBB: {
    host: ['rlsbb.ru'],
    condition: () => document.querySelectorAll('.post').length === 1,
    products: [
      {
        condition: () => document.querySelector('#post-wrapper .entry-meta a[href*="/category/movies/"]'),
        type: 'movie',
        data: () => document.querySelector('h1.entry-title').textContent.match(/(.+?)\s+\d{4}/)[1].trim()
      },
      {
        condition: () => document.querySelector('#post-wrapper .entry-meta a[href*="/category/tv-shows/"]'),
        type: 'tv',
        data: () => document.querySelector('h1.entry-title').textContent.match(/(.+?)\s+S\d{2}/)[1].trim()
      }]
  },
  showtime: {
    host: ['sho.com'],
    condition: Always,
    products: [
      {
        condition: () => parseLDJSON('@type') === 'Movie',
        type: 'movie',
        data: () => parseLDJSON('name', (j) => (j['@type'] === 'Movie'))
      },
      {
        condition: () => parseLDJSON('@type') === 'TVSeries',
        type: 'tv',
        data: () => parseLDJSON('name', (j) => (j['@type'] === 'TVSeries'))
      }]
  },
  psapm: {
    host: ['psa.pm'],
    condition: Always,
    products: [
      {
        condition: () => document.location.pathname.startsWith('/movie/'),
        type: 'movie',
        data: function () {
          const title = document.querySelector('h1').textContent.trim()
          const m = title.match(/(.+)\((\d+)\)$/)
          if (m) {
            return [m[1].trim(), parseInt(m[2])]
          } else {
            return title
          }
        }
      },
      {
        condition: () => document.location.pathname.startsWith('/tv-show/'),
        type: 'tv',
        data: () => document.querySelector('h1').textContent.trim()
      }
    ]
  }
}

function main () {
  let dataFound = false

  for (const name in sites) {
    const site = sites[name]
    if (site.host.some(function (e) { return ~this.indexOf(e) }, document.location.hostname) && site.condition()) {
      for (let i = 0; i < site.products.length; i++) {
        if (site.products[i].condition()) {
          // Try to retrieve item name from page
          let data
          try {
            data = site.products[i].data()
          } catch (e) {
            data = false
            console.error(`ShowRottentomatoes: Error in data() of site='${name}', type='${site.products[i].type}'`)
            console.error(e)
          }
          if (data) {
            if (Array.isArray(data) && data[1]) {
              loadMeter(data[0].trim(), site.products[i].type, parseInt(data[1]))
            } else {
              loadMeter(data.trim(), site.products[i].type)
            }
            dataFound = true
          }
          break
        }
      }
      break
    }
  }
  return dataFound
}

(function () {
  if (document.location.href === 'https://www.rottentomatoes.com/') {
    updateAlgolia()
  }

  const firstRunResult = main()
  let lastLoc = document.location.href
  let lastContent = document.body.innerText
  let lastCounter = 0
  function newpage () {
    if (lastContent === document.body.innerText && lastCounter < 15) {
      window.setTimeout(newpage, 500)
      lastCounter++
    } else {
      lastContent = document.body.innerText
      lastCounter = 0
      const re = main()
      if (!re) { // No page matched or no data found
        window.setTimeout(newpage, 1000)
      }
    }
  }
  window.setInterval(function () {
    if (document.location.href !== lastLoc) {
      lastLoc = document.location.href
      $('#mcdiv321rotten').remove()

      window.setTimeout(newpage, 1000)
    }
  }, 500)

  if (!firstRunResult) {
    // Initial run had no match, let's try again there may be new content
    window.setTimeout(main, 2000)
  }
})()
