/**
 * Fetch search results of search suggestions from the Addsearch API
 */
export function executeApiFetch(type, keyword, cb) {

  const RESPONSE_OK = 200;
  const RESPONSE_BAD_REQUEST = 400;
  const RESPONSE_SERVER_ERROR = 500;

  // Validate query type
  if (type !== 'search' && type !== 'suggest') {
    cb({response: RESPONSE_BAD_REQUEST, message: 'invalid query type'});
    return;
  }

  // If no keyword, fetch all results
  let kw = keyword || '*';

  // Boolean operators (AND, OR, NOT) uppercase
  kw = kw.replace(/ and /g, ' AND ').replace(/ or /g, ' OR ').replace(/ not /g, ' NOT ');

  // Escape
  kw = encodeURIComponent(kw);

  // Execute API call
  fetch('https://api.addsearch.com/v1/' + type + '/' + this.sitekey + '?term=' + kw)
    .then(function(response) {
      return response.json();
    }).then(function(json) {
    json.response = RESPONSE_OK;
    cb(json);
  }).catch(function(ex) {
    cb({response: RESPONSE_SERVER_ERROR, message: 'invalid server response'});
  });
};
