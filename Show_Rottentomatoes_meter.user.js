// ==UserScript==
// @name        Show Rottentomatoes meter
// @description Show Rotten Tomatoes score on imdb.com, metacritic.com, letterboxd.com, BoxOfficeMojo, serienjunkies.de, Amazon, tv.com, Google Play, allmovie.com, Wikipedia, themoviedb.org, movies.com, tvmaze.com, tvguide.com, followshows.com, thetvdb.com, tvnfo.com
// @namespace   cuzi
// @updateURL   https://openuserjs.org/meta/cuzi/Show_Rottentomatoes_meter.meta.js
// @grant       GM_xmlhttpRequest
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       unsafeWindow
// @grant       GM.xmlHttpRequest
// @grant       GM.setValue
// @grant       GM.getValue
// @require     http://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
// @license     GPL-3.0-or-later; http://www.gnu.org/licenses/gpl-3.0.txt
// @version     23
// @connect     www.rottentomatoes.com
// @include     https://play.google.com/store/movies/details/*
// @include     http://www.amazon.com/*
// @include     https://www.amazon.com/*
// @include     http://www.amazon.co.uk/*
// @include     https://www.amazon.co.uk/*
// @include     http://www.amazon.fr/*
// @include     https://www.amazon.fr/*
// @include     http://www.amazon.de/*
// @include     https://www.amazon.de/*
// @include     http://www.amazon.es/*
// @include     https://www.amazon.es/*
// @include     http://www.amazon.ca/*
// @include     https://www.amazon.ca/*
// @include     http://www.amazon.in/*
// @include     https://www.amazon.in/*
// @include     http://www.amazon.it/*
// @include     https://www.amazon.it/*
// @include     http://www.amazon.co.jp/*
// @include     https://www.amazon.co.jp/*
// @include     http://www.amazon.com.mx/*
// @include     https://www.amazon.com.mx/*
// @include     http://www.amazon.com.au/*
// @include     https://www.amazon.com.au/*
// @include     http://www.imdb.com/title/*
// @include     https://www.imdb.com/title/*
// @include     http://www.serienjunkies.de/*
// @include     https://www.serienjunkies.de/*
// @include     http://www.tv.com/shows/*
// @include     http://www.boxofficemojo.com/movies/*
// @include     https://www.boxofficemojo.com/movies/*
// @include     https://www.boxofficemojo.com/release/*
// @include     http://www.allmovie.com/movie/*
// @include     https://www.allmovie.com/movie/*
// @include     https://en.wikipedia.org/*
// @include     https://www.fandango.com/*
// @include     https://www.themoviedb.org/movie/*
// @include     https://www.themoviedb.org/tv/*
// @include     http://letterboxd.com/film/*
// @include     https://letterboxd.com/film/*
// @exclude     https://letterboxd.com/film/*/image*
// @include     http://www.tvmaze.com/shows/*
// @include     https://www.tvmaze.com/shows/*
// @include     http://www.tvguide.com/tvshows/*
// @include     https://www.tvguide.com/tvshows/*
// @include     http://followshows.com/show/*
// @include     https://followshows.com/show/*
// @include     https://thetvdb.com/series/*
// @include     https://thetvdb.com/movies/*
// @include     http://tvnfo.com/s/*
// @include     https://tvnfo.com/s/*
// @include     http://www.metacritic.com/movie/*
// @include     https://www.metacritic.com/movie/*
// @include     http://www.metacritic.com/tv/*
// @include     https://www.metacritic.com/tv/*
// @include     https://www.nme.com/reviews/movie/*
// @include     https://itunes.apple.com/*/movie/*
// @include     https://itunes.apple.com/*/tv-season/*
// @include     http://epguides.com/*
// @include     http://www.epguides.com/*
// @include     https://sharetv.com/shows/*
// @include     http://www.cc.com/*
// @include     https://www.tvhoard.com/*
// @include     https://www.amc.com/*
// @include     http://rlsbb.ru/*/
// ==/UserScript==

/* global GM, $, unsafeWindow */

const baseURL = 'https://www.rottentomatoes.com'
const baseURL_search = baseURL + '/api/private/v2.0/search/?limit=100&q={query}&t={type}'
const baseURL_openTab = baseURL + '/search/?search={query}'
const cacheExpireAfterHours = 4
const emoji_tomato = 0x1F345
const emoji_green_apple = 0x1F34F
const emoji_strawberry = 0x1F353

function minutesSince (time) {
  const seconds = ((new Date()).getTime() - time.getTime()) / 1000
  return seconds > 60 ? parseInt(seconds / 60) + ' min ago' : 'now'
}

const parseLDJSON_cache = {}
function parseLDJSON (keys, condition) {
  if (document.querySelector('script[type="application/ld+json"]')) {
    const data = []
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    for (let i = 0; i < scripts.length; i++) {
      let jsonld
      if (scripts[i].innerText in parseLDJSON_cache) {
        jsonld = parseLDJSON_cache[scripts[i].innerText]
      } else {
        try {
          jsonld = JSON.parse(scripts[i].innerText)
          parseLDJSON_cache[scripts[i].innerText] = jsonld
        } catch (e) {
          parseLDJSON_cache[scripts[i].innerText] = null
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
    textInside = String.fromCodePoint(emoji_strawberry) + ' ' + data.meterScore + '%'
    width = data.meterScore
  } else if (data.meterClass === 'fresh') {
    barColor = '#C91B22'
    color = 'white'
    textInside = String.fromCodePoint(emoji_tomato) + ' ' + data.meterScore + '%'
    width = data.meterScore
  } else if (data.meterClass === 'rotten') {
    color = 'gray'
    barColor = '#94B13C'
    if (data.meterScore > 30) {
      textAfter = data.meterScore + '% '
      textInside = '<span style="font-size:13px">' + String.fromCodePoint(emoji_green_apple) + '</span>'
    } else {
      textAfter = data.meterScore + '% <span style="font-size:13px">' + String.fromCodePoint(emoji_green_apple) + '</span>'
    }
    width = data.meterScore
  } else {
    bgColor = barColor = '#787878'
    color = 'silver'
    textInside = 'N/A'
    width = 100
  }

  return '<div style="width:100px; overflow: hidden;height: 20px;background-color: ' + bgColor + ';color: ' + color + ';text-align:center; border-radius: 4px;box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);">' +
    '<div style="width:' + data.meterScore + '%; background-color: ' + barColor + '; color: ' + color + '; font-size:14px; font-weight:bold; text-align:center; float:left; height: 100%;line-height: 20px;box-shadow: inset 0 -1px 0 rgba(0,0,0,0.15);transition: width 0.6s ease;">' + textInside + '</div>' + textAfter + '</div>'
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

  const url = baseURL_search.replace('{query}', encodeURIComponent(query)).replace('{type}', encodeURIComponent(rottenType))

  const cache = JSON.parse(await GM.getValue('cache', '{}'))

  // Delete cached values, that are expired
  for (const prop in cache) {
    if ((new Date()).getTime() - (new Date(cache[prop].time)).getTime() > cacheExpireAfterHours * 60 * 60 * 1000) {
      delete cache[prop]
    }
  }

  // Check cache or request new content
  if (url in cache) {
    // Use cached response
    handleResponse(cache[url])
  } else {
    GM.xmlHttpRequest({
      method: 'GET',
      url: url,
      onload: function (response) {
        // Save to chache

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
        console.log('Rottentomatoes GM.xmlHttpRequest Error: ' + response.status + '\nURL: ' + url + '\nResponse:\n' + response.responseText)
      }
    })
  }
}

function handleResponse (response) {
  // Handle GM.xmlHttpRequest response

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
    function matchQuality (title, year) {
      if (title === current.query && year === current.year) {
        return 102 + year
      }
      if (title === current.query && current.year) {
        return 101 - Math.abs(year - current.year)
      }
      if (title.replace(/\(.+\)/, '').trim() === current.query && current.year) {
        return 100 - Math.abs(year - current.year)
      }
      if (title === current.query) {
        return 7
      }
      if (title.replace(/\(.+\)/, '').trim() === current.query) {
        return 6
      }
      if (title.startsWith(current.query)) {
        return 5
      }
      if (current.query.indexOf(title) !== -1) {
        return 4
      }
      if (title.indexOf(current.query) !== -1) {
        return 3
      }
      if (current.query.toLowerCase().indexOf(title.toLowerCase()) !== -1) {
        return 2
      }
      if (title.toLowerCase().indexOf(current.query.toLowerCase()) !== -1) {
        return 1
      }
      return 0
    }

    data[prop].sort(function (a, b) {
      if (!a.hasOwnProperty('matchQuality')) {
        a.matchQuality = matchQuality(a.name, a.year)
      }
      if (!b.hasOwnProperty('matchQuality')) {
        b.matchQuality = matchQuality(b.name, b.year)
      }

      return b.matchQuality - a.matchQuality
    })

    showMeter(data[prop], new Date(response.time))
  } else {
    console.log('Rottentomatoes: No results for ' + current.query)
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
  $('<div class="firstResult"><a style="font-size:small; color:#136CB2; " href="' + baseURL + arr[0].url + '">' + arr[0].name + ' (' + arr[0].year + ')</a>' + meterBar(arr[0]) + '</div>').appendTo(main)

  // Shall the following results be collapsed by default?
  if ((arr.length > 1 && arr[0].matchQuality > 10) || arr.length > 10) {
    $('<span style="color:gray;font-size: x-small">More results...</span>').appendTo(main).click(function () { more.css('display', 'block'); this.parentNode.removeChild(this) })
    const more = div = $('<div style="display:none"></div>').appendTo(main)
  }

  // More results
  for (let i = 1; i < arr.length; i++) {
    $('<div><a style="font-size:small; color:#136CB2; " href="' + baseURL + arr[i].url + '">' + arr[i].name + ' (' + arr[i].year + ')</a>' + meterBar(arr[i]) + '</div>').appendTo(div)
  }

  // Footer
  const sub = $('<div></div>').appendTo(main)
  $('<time style="color:#b6b6b6; font-size: 11px;" datetime="' + time + '" title="' + time.toLocaleTimeString() + ' ' + time.toLocaleDateString() + '">' + minutesSince(time) + '</time>').appendTo(sub)
  $('<a style="color:#b6b6b6; font-size: 11px;" target="_blank" href="' + baseURL_openTab.replace('{query}', encodeURIComponent(current.query)) + '" title="Open Rotten Tomatoes">@rottentomatoes.com</a>').appendTo(sub)
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
            return [document.querySelector('.title_wrapper h1').firstChild.data.trim(), year] // Use localized title
          } else if (document.querySelector('h1[itemprop=name]')) { // Movie homepage (New design 2015-12)
            return [document.querySelector('h1[itemprop=name]').firstChild.textContent.trim(), year]
          } else if (document.querySelector('*[itemprop=name] a') && document.querySelector('*[itemprop=name] a').firstChild.data) { // Subpage of a move
            return [document.querySelector('*[itemprop=name] a').firstChild.data.trim(), year]
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
        } else if (document.querySelector('.release_data .data')) {
          year = document.querySelector('.release_data .data').textContent.match(/(\d{4})/)[1]
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
        data: () => document.querySelector('[data-automation-id=title]').textContent.trim()
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
          return [document.querySelector('#body table:nth-child(2) tr:first-child b').firstChild.data, year]
        }
      }]
  },
  AllMovie: {
    host: ['allmovie.com'],
    condition: () => document.querySelector('h2[itemprop=name].movie-title'),
    products: [{
      condition: () => document.querySelector('h2[itemprop=name].movie-title'),
      type: 'movie',
      data: () => document.querySelector('h2[itemprop=name].movie-title').firstChild.data.trim()
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
        return $('#catlinks a').filter((i, e) => e.firstChild.data.match(r)).length
      },
      type: 'movie',
      data: () => document.querySelector('.infobox .summary').firstChild.data
    },
    {
      condition: function () {
        if (!document.querySelector('.infobox .summary')) {
          return false
        }
        const r = /television series/
        return $('#catlinks a').filter((i, e) => e.firstChild.data.match(r)).length
      },
      type: 'tv',
      data: () => document.querySelector('.infobox .summary').firstChild.data
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
      data: () => document.querySelector('h1').firstChild.data
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
      data: () => document.getElementById('series_title').firstChild.data.trim()
    },
    {
      condition: () => document.location.pathname.startsWith('/movies/'),
      type: 'movie',
      data: () => document.getElementById('series_title').firstChild.data.trim()
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
      condition: () => document.location.pathname.startsWith('/reviews/movie/'),
      type: 'movie',
      data: function () {
        let year = null
        try {
          year = parseInt(document.querySelector('*[itemprop=datePublished]').content.match(/\d{4}/)[0])
        } catch (e) {}

        try {
          return [document.querySelector('.title-primary').textContent.match(/‘(.+?)’/)[1], year]
        } catch (e) {
          return [document.querySelector('h1').textContent.match(/:\s*(.+)/)[1].trim(), year]
        }
      }
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
    condition: () => document.getElementById('TVHeader'),
    products: [{
      condition: () => document.getElementById('TVHeader') && document.querySelector('body>div#header h1'),
      type: 'tv',
      data: () => document.querySelector('body>div#header h1').textContent.trim()
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
      data: () => document.querySelector("meta[property='og:title']").content
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
  RlsBB: {
    host: ['rlsbb.ru'],
    condition: () => document.querySelectorAll('.post').length === 1,
    products: [
      {
        condition: () => document.querySelector('.post .postSubTitle a[href*="/category/movies/"]'),
        type: 'movie',
        data: () => document.querySelector('h1.postTitle').textContent.match(/(.+?)\s+\d{4}/)[1].trim()
      },
      {
        condition: () => document.querySelector('.post .postSubTitle a[href*="/category/tv-shows/"]'),
        type: 'tv',
        data: () => document.querySelector('h1.postTitle').textContent.match(/(.+?)\s+S\d{2}/)[1].trim()
      }]
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
