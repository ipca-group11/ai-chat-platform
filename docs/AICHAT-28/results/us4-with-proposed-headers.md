# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 2 |
| Low | 1 |
| Informational | 5 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Low | Warning |  | ZAP warnings logged - see the zap.log file for details | 9    |
| Info | Informational | http://localhost:12347 | Percentage of endpoints with content type text/plain | 81 % |
| Info | Informational | http://localhost:12347 | Percentage of endpoints with method OPTIONS | 18 % |
| Info | Informational | http://localhost:12347 | Percentage of endpoints with method POST | 81 % |
| Info | Informational | http://localhost:12347 | Count of total endpoints | 16    |
| Info | Informational | http://localhost:3001 | Percentage of endpoints with content type text/javascript | 100 % |
| Info | Informational | http://localhost:3001 | Percentage of endpoints with method GET | 100 % |
| Info | Informational | http://localhost:3001 | Count of total endpoints | 14    |
| Info | Informational | http://localhost:3002 | Percentage of endpoints with content type text/javascript | 100 % |
| Info | Informational | http://localhost:3002 | Percentage of endpoints with method GET | 100 % |
| Info | Informational | http://localhost:3002 | Count of total endpoints | 7    |
| Info | Informational | http://localhost:3003 | Percentage of endpoints with content type text/javascript | 100 % |
| Info | Informational | http://localhost:3003 | Percentage of endpoints with method GET | 100 % |
| Info | Informational | http://localhost:3003 | Count of total endpoints | 7    |
| Info | Informational | http://localhost:8081 | Percentage of responses with status code 2xx | 54 % |
| Info | Informational | http://localhost:8081 | Percentage of responses with status code 3xx | 35 % |
| Info | Informational | http://localhost:8081 | Percentage of responses with status code 4xx | 10 % |
| Info | Informational | http://localhost:8081 | Percentage of endpoints with content type application/json | 6 % |
| Info | Informational | http://localhost:8081 | Percentage of endpoints with content type text/css | 3 % |
| Info | Informational | http://localhost:8081 | Percentage of endpoints with content type text/html | 15 % |
| Info | Informational | http://localhost:8081 | Percentage of endpoints with content type text/javascript | 72 % |
| Info | Informational | http://localhost:8081 | Percentage of endpoints with method GET | 96 % |
| Info | Informational | http://localhost:8081 | Percentage of endpoints with method POST | 3 % |
| Info | Informational | http://localhost:8081 | Count of total endpoints | 33    |
| Info | Informational | http://localhost:8081 | Percentage of slow responses | 4 % |
| Info | Informational | https://fonts.googleapis.com | Percentage of endpoints with content type text/css | 100 % |
| Info | Informational | https://fonts.googleapis.com | Percentage of endpoints with method GET | 100 % |
| Info | Informational | https://fonts.googleapis.com | Count of total endpoints | 1    |
| Info | Informational | https://fonts.gstatic.com | Percentage of endpoints with content type font/woff2 | 100 % |
| Info | Informational | https://fonts.gstatic.com | Percentage of endpoints with method GET | 100 % |
| Info | Informational | https://fonts.gstatic.com | Count of total endpoints | 1    |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| CSP: style-src unsafe-inline | Medium | Systemic |
| Sub Resource Integrity Attribute Missing | Medium | Systemic |
| Cross-Origin-Embedder-Policy Header Missing or Invalid | Low | Systemic |
| Information Disclosure - Information in Browser localStorage | Informational | 1 |
| Information Disclosure - Information in Browser sessionStorage | Informational | 4 |
| Modern Web Application | Informational | Systemic |
| Storable and Cacheable Content | Informational | 1 |
| Storable but Non-Cacheable Content | Informational | Systemic |
| Vulnerable JS Library | 				False Positives: | 1 |




## Alert Detail



### [ CSP: style-src unsafe-inline ](https://www.zaproxy.org/docs/alerts/10055/)



##### Medium (High)

### Description

Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks. Including (but not limited to) Cross Site Scripting (XSS), and data injection attacks. These attacks are used for everything from data theft to site defacement or distribution of malware. CSP provides a set of standard HTTP headers that allow website owners to declare approved sources of content that browsers should be allowed to load on that page — covered types are JavaScript, CSS, HTML frames, fonts, images and embeddable objects such as Java applets, ActiveX, audio and video files.

* URL: http://localhost:8081
  * Node Name: `http://localhost:8081`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' http://localhost:3001 http://localhost:3002 http://localhost:3003; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:3001 http://localhost:3002 http://localhost:3003 http://localhost:12347; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://localhost:8081/
  * Node Name: `http://localhost:8081/`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' http://localhost:3001 http://localhost:3002 http://localhost:3003; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:3001 http://localhost:3002 http://localhost:3003 http://localhost:12347; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://localhost:8081/login%3Fredirect=%252Fchats
  * Node Name: `http://localhost:8081/login (redirect)`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' http://localhost:3001 http://localhost:3002 http://localhost:3003; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:3001 http://localhost:3002 http://localhost:3003 http://localhost:12347; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://localhost:8081/robots.txt
  * Node Name: `http://localhost:8081/robots.txt`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' http://localhost:3001 http://localhost:3002 http://localhost:3003; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:3001 http://localhost:3002 http://localhost:3003 http://localhost:12347; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://localhost:8081/sitemap.xml
  * Node Name: `http://localhost:8081/sitemap.xml`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' http://localhost:3001 http://localhost:3002 http://localhost:3003; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:3001 http://localhost:3002 http://localhost:3003 http://localhost:12347; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`
  * Other Info: `style-src includes unsafe-inline.`

Instances: Systemic


### Solution

Ensure that your web server, application server, load balancer, etc. is properly configured to set the Content-Security-Policy header.

### Reference


* [ https://www.w3.org/TR/CSP/ ](https://www.w3.org/TR/CSP/)
* [ https://caniuse.com/#search=content+security+policy ](https://caniuse.com/#search=content+security+policy)
* [ https://content-security-policy.com/ ](https://content-security-policy.com/)
* [ https://github.com/HtmlUnit/htmlunit-csp ](https://github.com/HtmlUnit/htmlunit-csp)
* [ https://web.dev/articles/csp#resource-options ](https://web.dev/articles/csp#resource-options)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 15

#### Source ID: 3

### [ Sub Resource Integrity Attribute Missing ](https://www.zaproxy.org/docs/alerts/90003/)



##### Medium (High)

### Description

The integrity attribute is missing on a script or link tag served by an external server. The integrity tag prevents an attacker who have gained access to this server from injecting a malicious content.

* URL: http://localhost:8081
  * Node Name: `http://localhost:8081`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"
    />`
  * Other Info: ``
* URL: http://localhost:8081/
  * Node Name: `http://localhost:8081/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"
    />`
  * Other Info: ``
* URL: http://localhost:8081/login%3Fredirect=%252Fchats
  * Node Name: `http://localhost:8081/login (redirect)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"
    />`
  * Other Info: ``
* URL: http://localhost:8081/robots.txt
  * Node Name: `http://localhost:8081/robots.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"
    />`
  * Other Info: ``
* URL: http://localhost:8081/sitemap.xml
  * Node Name: `http://localhost:8081/sitemap.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"
    />`
  * Other Info: ``

Instances: Systemic


### Solution

Provide a valid integrity attribute to the tag.

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity ](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity)


#### CWE Id: [ 345 ](https://cwe.mitre.org/data/definitions/345.html)


#### WASC Id: 15

#### Source ID: 3

### [ Cross-Origin-Embedder-Policy Header Missing or Invalid ](https://www.zaproxy.org/docs/alerts/90004/)



##### Low (Medium)

### Description

Cross-Origin-Embedder-Policy header is a response header that prevents a document from loading any cross-origin resources that don't explicitly grant the document permission (using CORP or CORS).

* URL: http://localhost:8081
  * Node Name: `http://localhost:8081`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:8081/
  * Node Name: `http://localhost:8081/`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:8081/login%3Fredirect=%252Fchats
  * Node Name: `http://localhost:8081/login (redirect)`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:8081/robots.txt
  * Node Name: `http://localhost:8081/robots.txt`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:8081/sitemap.xml
  * Node Name: `http://localhost:8081/sitemap.xml`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``

Instances: Systemic


### Solution

Ensure that the application/web server sets the Cross-Origin-Embedder-Policy header appropriately, and that it sets the Cross-Origin-Embedder-Policy header to 'require-corp' for documents.
If possible, ensure that the end user uses a standards-compliant and modern web browser that supports the Cross-Origin-Embedder-Policy header (https://caniuse.com/mdn-http_headers_cross-origin-embedder-policy).

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 14

#### Source ID: 3

### [ Information Disclosure - Information in Browser localStorage ](https://www.zaproxy.org/docs/alerts/120000/)



##### Informational (High)

### Description

Information was stored in browser localStorage.
This is not unusual or necessarily unsafe - this informational alert has been raised to help you get a better understanding of what this app is doing. For more details see the Client tabs - this information was set directly in the browser and will therefore not necessarily appear in this form in any HTTP(S) messages.

* URL: http://localhost:8081/login%3Fredirect=%252Fchats
  * Node Name: `http://localhost:8081/login (redirect)`
  * Method: `GET`
  * Parameter: `theme`
  * Attack: ``
  * Evidence: ``
  * Other Info: `The following data (key=value) was set: theme=dark
Note that this alert will only be raised once for each URL + key.`


Instances: 1

### Solution

This is an informational alert and no action is necessary. 

### Reference



#### CWE Id: [ 359 ](https://cwe.mitre.org/data/definitions/359.html)


#### WASC Id: 13

#### Source ID: 3

### [ Information Disclosure - Information in Browser sessionStorage ](https://www.zaproxy.org/docs/alerts/120000/)



##### Informational (High)

### Description

Information was stored in browser sessionStorage.
This is not unusual or necessarily unsafe - this informational alert has been raised to help you get a better understanding of what this app is doing. For more details see the Client tabs - this information was set directly in the browser and will therefore not necessarily appear in this form in any HTTP(S) messages.

* URL: http://localhost:8081/chats
  * Node Name: `http://localhost:8081/chats`
  * Method: `GET`
  * Parameter: `com.grafana.faro.lastNavigationId`
  * Attack: ``
  * Evidence: ``
  * Other Info: `The following data (key=value) was set: com.grafana.faro.lastNavigationId=WAhadbcWvY
Note that this alert will only be raised once for each URL + key.`
* URL: http://localhost:8081/chats
  * Node Name: `http://localhost:8081/chats`
  * Method: `GET`
  * Parameter: `com.grafana.faro.session`
  * Attack: ``
  * Evidence: ``
  * Other Info: `The following data (key=value) was set: com.grafana.faro.session={"sessionId":"hdPq05VMW2","lastActivity":1791056924067,"started":1791056924067,"isSampled":true,"sessionMeta":{"id":"hdPq05VMW2","attributes":{"isSampled":"true"}}}
Note that this alert will only be raised once for each URL + key.`
* URL: http://localhost:8081/login%3Fredirect=%252Fchats
  * Node Name: `http://localhost:8081/login (redirect)`
  * Method: `GET`
  * Parameter: `com.grafana.faro.lastNavigationId`
  * Attack: ``
  * Evidence: ``
  * Other Info: `The following data (key=value) was set: com.grafana.faro.lastNavigationId=BiyAV1d1hQ
Note that this alert will only be raised once for each URL + key.`
* URL: http://localhost:8081/login%3Fredirect=%252Fchats
  * Node Name: `http://localhost:8081/login (redirect)`
  * Method: `GET`
  * Parameter: `com.grafana.faro.session`
  * Attack: ``
  * Evidence: ``
  * Other Info: `The following data (key=value) was set: com.grafana.faro.session={"sessionId":"X1R3tdbTJ3","lastActivity":1791056910068,"started":1791056910068,"isSampled":true,"sessionMeta":{"id":"X1R3tdbTJ3","attributes":{"isSampled":"true"}}}
Note that this alert will only be raised once for each URL + key.`


Instances: 4

### Solution

This is an informational alert and no action is necessary. 

### Reference



#### CWE Id: [ 359 ](https://cwe.mitre.org/data/definitions/359.html)


#### WASC Id: 13

#### Source ID: 3

### [ Modern Web Application ](https://www.zaproxy.org/docs/alerts/10109/)



##### Informational (Medium)

### Description

The application appears to be a modern web application. If you need to explore it automatically then the Client Spider may well be more effective than the standard one.

* URL: http://localhost:8081
  * Node Name: `http://localhost:8081`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script type="module" crossorigin src="/assets/mf-entry-bootstrap-0-feb606b9.js"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://localhost:8081/
  * Node Name: `http://localhost:8081/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script type="module" crossorigin src="/assets/mf-entry-bootstrap-0-feb606b9.js"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://localhost:8081/login%3Fredirect=%252Fchats
  * Node Name: `http://localhost:8081/login (redirect)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script type="module" crossorigin src="/assets/mf-entry-bootstrap-0-feb606b9.js"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://localhost:8081/robots.txt
  * Node Name: `http://localhost:8081/robots.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script type="module" crossorigin src="/assets/mf-entry-bootstrap-0-feb606b9.js"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://localhost:8081/sitemap.xml
  * Node Name: `http://localhost:8081/sitemap.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script type="module" crossorigin src="/assets/mf-entry-bootstrap-0-feb606b9.js"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`

Instances: Systemic


### Solution

This is an informational alert and so no changes are required.

### Reference




#### Source ID: 3

### [ Storable and Cacheable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are storable by caching components such as proxy servers, and may be retrieved directly from the cache, rather than from the origin server by the caching servers, in response to similar requests from other users. If the response data is sensitive, personal or user-specific, this may result in sensitive information being leaked. In some cases, this may even result in a user gaining complete control of the session of another user, depending on the configuration of the caching components in use in their environment. This is primarily an issue where "shared" caching servers such as "proxy" caches are configured on the local network. This configuration is typically found in corporate or educational environments, for instance.

* URL: http://localhost:8081/favicon.ico
  * Node Name: `http://localhost:8081/favicon.ico`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`


Instances: 1

### Solution

Validate that the response does not contain sensitive, personal or user-specific information. If it does, consider the use of the following HTTP response headers, to limit, or prevent the content being stored and retrieved from the cache by another user:
Cache-Control: no-cache, no-store, must-revalidate, private
Pragma: no-cache
Expires: 0
This configuration directs both HTTP 1.0 and HTTP 1.1 compliant caching servers to not store the response, and to not retrieve the response (without validation) from the cache, in response to a similar request.

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3

### [ Storable but Non-Cacheable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are storable by caching components such as proxy servers, but will not be retrieved directly from the cache, without validating the request upstream, in response to similar requests from other users.

* URL: http://localhost:8081
  * Node Name: `http://localhost:8081`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-cache`
  * Other Info: ``
* URL: http://localhost:8081/assets/index-BTgjxohI.css
  * Node Name: `http://localhost:8081/assets/index-BTgjxohI.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-cache`
  * Other Info: ``
* URL: http://localhost:8081/assets/mf-entry-bootstrap-0-feb606b9.js
  * Node Name: `http://localhost:8081/assets/mf-entry-bootstrap-0-feb606b9.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-cache`
  * Other Info: ``
* URL: http://localhost:8081/robots.txt
  * Node Name: `http://localhost:8081/robots.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-cache`
  * Other Info: ``
* URL: http://localhost:8081/sitemap.xml
  * Node Name: `http://localhost:8081/sitemap.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-cache`
  * Other Info: ``

Instances: Systemic


### Solution



### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3

### [ Vulnerable JS Library ](https://www.zaproxy.org/docs/alerts/10003/)



##### 				False Positives: (False Positive)

### Description

The identified library appears to be vulnerable.

* URL: http://localhost:8081/assets/mf-entry-bootstrap-0-feb606b9.js
  * Node Name: `http://localhost:8081/assets/mf-entry-bootstrap-0-feb606b9.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `bootstrap-0-feb606b9.js`
  * Other Info: `The identified library bootstrap, version 0-feb606b9 is vulnerable.
CVE-2018-20677
CVE-2018-20676
https://github.com/advisories/GHSA-ph58-4vrj-w6hr
https://github.com/twbs/bootstrap/issues/20631
https://github.com/twbs/bootstrap/pull/3421
https://nvd.nist.gov/vuln/detail/CVE-2018-20676
`


Instances: 1

### Solution

Upgrade to the latest version of the affected library.

### Reference


* [ https://owasp.org/Top10/2021/A06_2021-Vulnerable_and_Outdated_Components/ ](https://owasp.org/Top10/2021/A06_2021-Vulnerable_and_Outdated_Components/)


#### CWE Id: [ 1395 ](https://cwe.mitre.org/data/definitions/1395.html)


#### Source ID: 3


