'use strict';

require('es6-promise').polyfill();
const axios = require('axios').default;

/**
 * Fetch search results of search suggestions from the Addsearch API
 */
var executeApiFetch = function(apiHostname, sitekey, type, settings, cb, fuzzyRetry, customFilterObject, recommendOptions) {

  const RESPONSE_BAD_REQUEST = 400;
  const RESPONSE_SERVER_ERROR = 500;

  var settingToQueryParam = function(setting, key) {
    if (setting || setting === false) {
      return '&' + key + '=' + setting;
    }
    return '';
  };


  // Validate query type
  if (type !== 'search' && type !== 'suggest' && type !== 'autocomplete' && type !== 'recommend') {
    cb({error: {response: RESPONSE_BAD_REQUEST, message: 'invalid query type'}});
    return;
  }

  // Keyword and query string
  var kw = '';
  var qs = '';

  // API Path (eq. /search, /suggest, /autocomplete/document-field)
  var api = null;
  var apiPath = null;

  // Search
  if (type === 'search') {
    // Path
    apiPath = type;

    // Keyword
    kw = settings.keyword;

    // Boolean operators (AND, OR, NOT) uppercase
    kw = settings.enableLogicalOperators ?
      kw.replace(/ and /g, ' AND ').replace(/ or /g, ' OR ').replace(/ not /g, ' NOT ') :
      kw.replace(/ AND /g, ' and ').replace(/ OR /g, ' or ').replace(/ NOT /g, ' not ');

    // Escape
    kw = encodeURIComponent(kw);

    // Fuzzy
    var fuzzy = settings.fuzzy;
    if (fuzzy === 'retry') {
      // First call, non fuzzy
      if (fuzzyRetry !== true) {
        fuzzy = false;
      }
      // Second call, fuzzy
      else {
        fuzzy = true;
      }
    }

    // Construct query string from settings
    if (type === 'search') {
      qs = settingToQueryParam(settings.lang, 'lang') +
        settingToQueryParam(fuzzy, 'fuzzy') +
        settingToQueryParam(settings.collectAnalytics, 'collectAnalytics') +
        settingToQueryParam(settings.postfixWildcard, 'postfixWildcard') +
        settingToQueryParam(settings.categories, 'categories') +
        settingToQueryParam(settings.priceFromCents, 'priceFromCents') +
        settingToQueryParam(settings.priceToCents, 'priceToCents') +
        settingToQueryParam(settings.dateFrom, 'dateFrom') +
        settingToQueryParam(settings.dateTo, 'dateTo') +
        settingToQueryParam(settings.paging.page, 'page') +
        settingToQueryParam(settings.paging.pageSize, 'limit') +
        settingToQueryParam(settings.shuffleAndLimitTo, 'shuffleAndLimitTo') +
        settingToQueryParam(settings.jwt, 'jwt') +
        settingToQueryParam(settings.resultType, 'resultType') +
        settingToQueryParam(settings.userToken, 'userToken') +
        settingToQueryParam(settings.numFacets, 'numFacets') +
        settingToQueryParam(settings.cacheResponseTime, 'cacheResponseWithTtlSeconds') +
        settingToQueryParam(settings.searchOperator, 'defaultOperator') +
        settingToQueryParam(settings.analyticsTag, 'analyticsTag');

      // Add sortBy and sortOrder
      if (Array.isArray(settings.paging.sortBy)) {
        settings.paging.sortBy.forEach(function(value, index) {
          qs = qs + settingToQueryParam(value, 'sort') +
            settingToQueryParam(settings.paging.sortOrder[index], 'order');
        });
      } else {
        qs = qs + settingToQueryParam(settings.paging.sortBy, 'sort') +
          settingToQueryParam(settings.paging.sortOrder, 'order');
      }

      // Add custom field filters
      if (settings.customFieldFilters) {
        for (let i = 0; i < settings.customFieldFilters.length; i++) {
          qs = qs + '&customField=' + settings.customFieldFilters[i];
        }
      }

      // Add facet fields
      if (settings.facetFields) {
        for (let i = 0; i<settings.facetFields.length; i++) {
          qs = qs + '&facet=' + settings.facetFields[i];
        }
      }


      // Range facets
      if (settings.rangeFacets) {
        qs = qs + '&rangeFacets=' + encodeURIComponent(JSON.stringify(settings.rangeFacets));
      }

      // Hierarchical facets
      if (settings.hierarchicalFacetSetting) {
        qs = qs + '&hierarchicalFacets=' + encodeURIComponent(JSON.stringify(settings.hierarchicalFacetSetting));
      }


      // Stats fields
      if (settings.statsFields) {
        for (var i = 0; i<settings.statsFields.length; i++) {
          qs = qs + '&fieldStat=' + settings.statsFields[i];
        }
      }


      // Personalization events
      if (settings.personalizationEvents && Array.isArray(settings.personalizationEvents)) {
        for (let i = 0; i<settings.personalizationEvents.length; i++) {
          var obj = settings.personalizationEvents[i];
          var key = Object.keys(obj);
          qs = qs + '&personalizationEvent=' + encodeURIComponent(key + '=' + obj[key]);
        }
      }

      // Filter object
      if (customFilterObject) {
        qs = qs + '&filter=' + encodeURIComponent(JSON.stringify(customFilterObject));
      } else if (settings.filterObject) {
        qs = qs + '&filter=' + encodeURIComponent(JSON.stringify(settings.filterObject));
      }

    }
  }

  // Suggest
  else if (type === 'suggest') {
    apiPath = type;
    qs = settingToQueryParam(settings.suggestionsSize, 'size') +
      settingToQueryParam(settings.lang, 'lang');
    kw = settings.suggestionsPrefix;
  }

  // Autocomplete
  else if (type === 'autocomplete') {
    apiPath = 'autocomplete/document-field';
    qs = settingToQueryParam(settings.autocomplete.field, 'source') +
         settingToQueryParam(settings.autocomplete.size, 'size');
    kw = settings.autocomplete.prefix;
  }

  else if (type === 'recommend') {
    apiPath = 'recommendations';
    qs = settingToQueryParam(recommendOptions.itemId, 'itemId');
  }

  // Execute API call
  api = type === 'recommend' ?
    'https://' + apiHostname + '/v1/' + apiPath + '/' + sitekey + '?configurationKey=' + recommendOptions.configurationKey + qs :
    'https://' + apiHostname + '/v1/' + apiPath + '/' + sitekey + '?term=' + kw + qs;

  axios.get(api)
    .then(function(response) {
      var json = response.data;
      // Search again with fuzzy=true if no hits
      if (type === 'search' && settings.fuzzy === 'retry' && json.total_hits === 0 && fuzzyRetry !== true) {
        executeApiFetch(apiHostname, sitekey, type, settings, cb, true);
      }

      // Fuzzy not "retry" OR fuzzyRetry already returning
      else {

        // Cap fuzzy results to one page as quality decreases quickly
        if (fuzzyRetry === true) {
          var pageSize = settings.paging.pageSize;
          if (json.total_hits >= pageSize) {
            json.total_hits = pageSize;
          }
        }

        // Callback
        cb(json);
      }
    })
    .catch(function(ex) {
      console.log(ex);
      cb({error: {response: RESPONSE_SERVER_ERROR, message: 'invalid server response'}});
    });
};
module.exports = executeApiFetch;
