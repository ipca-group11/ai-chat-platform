# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 2 |
| Low | 3 |
| Informational | 5 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Low | Warning |  | ZAP errors logged - see the zap.log file for details | 2    |
| Low | Warning |  | ZAP warnings logged - see the zap.log file for details | 63    |
| Low | Exceeded High | http://localhost:8000 | Percentage of responses with status code 4xx | 84 % |
| Info | Informational |  | Percentage of network failures | 1 % |
| Info | Informational | http://localhost:8000 | Percentage of responses with status code 2xx | 11 % |
| Info | Informational | http://localhost:8000 | Percentage of responses with status code 5xx | 3 % |
| Info | Informational | http://localhost:8000 | Percentage of endpoints with content type application/json | 57 % |
| Info | Informational | http://localhost:8000 | Percentage of endpoints with content type text/html | 11 % |
| Info | Informational | http://localhost:8000 | Percentage of endpoints with method DELETE | 6 % |
| Info | Informational | http://localhost:8000 | Percentage of endpoints with method GET | 57 % |
| Info | Informational | http://localhost:8000 | Percentage of endpoints with method PATCH | 1 % |
| Info | Informational | http://localhost:8000 | Percentage of endpoints with method POST | 33 % |
| Info | Informational | http://localhost:8000 | Count of total endpoints | 223    |
| Info | Informational | http://localhost:8000 | Percentage of slow responses | 4 % |
| Info | Informational | https://localhost:8000 | Percentage of endpoints with method DELETE | 100 % |
| Info | Informational | https://localhost:8000 | Count of total endpoints | 1    |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Format String Error | Medium | 1 |
| HTTP Only Site | Medium | 1 |
| A Server Error response code was returned by the server | Low | 3 |
| Cross Site Scripting Weakness (Persistent in JSON Response) | Low | 2 |
| Unexpected Content-Type was returned | Low | 32 |
| A Client Error response code was returned by the server | Informational | 230 |
| Authentication Request Identified | Informational | 1 |
| Non-Storable Content | Informational | Systemic |
| Storable and Cacheable Content | Informational | 5 |
| User Agent Fuzzer | Informational | Systemic |




## Alert Detail



### [ Format String Error ](https://www.zaproxy.org/docs/alerts/30002/)



##### Medium (Medium)

### Description

A Format String error occurs when the submitted data of an input string is evaluated as a command by the application.

* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments ()(multipart:file)`
  * Method: `POST`
  * Parameter: `file`
  * Attack: `ZAP%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s
`
  * Evidence: ``
  * Other Info: `Potential Format String Error. The script closed the connection on a /%s.`


Instances: 1

### Solution

Rewrite the background program using proper deletion of bad character strings. This will require a recompile of the background executable.

### Reference


* [ https://owasp.org/www-community/attacks/Format_string_attack ](https://owasp.org/www-community/attacks/Format_string_attack)


#### CWE Id: [ 134 ](https://cwe.mitre.org/data/definitions/134.html)


#### WASC Id: 6

#### Source ID: 1

### [ HTTP Only Site ](https://www.zaproxy.org/docs/alerts/10106/)



##### Medium (Medium)

### Description

The site is only served under HTTP and not HTTPS.

* URL: http://localhost:8000/api/chats/cm0example0000000000000000
  * Node Name: `https://localhost:8000/api/chats/cm0example0000000000000000`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Failed to connect.
ZAP attempted to connect via: https://localhost:8000/api/chats/cm0example0000000000000000`


Instances: 1

### Solution

Configure your web or application server to use SSL (https).

### Reference


* [ https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html ](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)
* [ https://letsencrypt.org/ ](https://letsencrypt.org/)


#### CWE Id: [ 311 ](https://cwe.mitre.org/data/definitions/311.html)


#### WASC Id: 4

#### Source ID: 1

### [ A Server Error response code was returned by the server ](https://www.zaproxy.org/docs/alerts/100000/)



##### Low (High)

### Description

A response code of 500 was returned by the server.
This may indicate that the application is failing to handle unexpected input correctly.
Raised by the 'Alert on HTTP Response Code Error' script

* URL: http://localhost:8000/api/chats
  * Node Name: `http://localhost:8000/api/chats ()({title,provider,model,reasoning,webFetch})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments ()(multipart:file)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments ()(multipart:rtobject)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``


Instances: 3

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

### [ Cross Site Scripting Weakness (Persistent in JSON Response) ](https://www.zaproxy.org/docs/alerts/40014/)



##### Low (Low)

### Description

A XSS attack was found in a JSON response, this might leave content consumers vulnerable to attack if they don't appropriately handle the data (response).

* URL: http://localhost:8000/api/chats
  * Node Name: `http://localhost:8000/api/chats`
  * Method: `GET`
  * Parameter: `model`
  * Attack: `<script>alert(1);</script>`
  * Evidence: ``
  * Other Info: `Raised with LOW confidence as the Content-Type is not HTML.`
* URL: http://localhost:8000/api/chats
  * Node Name: `http://localhost:8000/api/chats`
  * Method: `GET`
  * Parameter: `title`
  * Attack: `<script>alert(1);</script>`
  * Evidence: ``
  * Other Info: `Raised with LOW confidence as the Content-Type is not HTML.`


Instances: 2

### Solution

Phase: Architecture and Design
Use a vetted library or framework that does not allow this weakness to occur or provides constructs that make this weakness easier to avoid.
Examples of libraries and frameworks that make it easier to generate properly encoded output include Microsoft's Anti-XSS library, the OWASP ESAPI Encoding module, and Apache Wicket.

Phases: Implementation; Architecture and Design
Understand the context in which your data will be used and the encoding that will be expected. This is especially important when transmitting data between different components, or when generating outputs that can contain multiple encodings at the same time, such as web pages or multi-part mail messages. Study all expected communication protocols and data representations to determine the required encoding strategies.
For any data that will be output to another web page, especially any data that was received from external inputs, use the appropriate encoding on all non-alphanumeric characters.
Consult the XSS Prevention Cheat Sheet for more details on the types of encoding and escaping that are needed.

Phase: Architecture and Design
For any security checks that are performed on the client side, ensure that these checks are duplicated on the server side, in order to avoid CWE-602. Attackers can bypass the client-side checks by modifying values after the checks have been performed, or by changing the client to remove the client-side checks entirely. Then, these modified values would be submitted to the server.

If available, use structured mechanisms that automatically enforce the separation between data and code. These mechanisms may be able to provide the relevant quoting, encoding, and validation automatically, instead of relying on the developer to provide this capability at every point where output is generated.

Phase: Implementation
For every web page that is generated, use and specify a character encoding such as ISO-8859-1 or UTF-8. When an encoding is not specified, the web browser may choose a different encoding by guessing which encoding is actually being used by the web page. This can cause the web browser to treat certain sequences as special, opening up the client to subtle XSS attacks. See CWE-116 for more mitigations related to encoding/escaping.

To help mitigate XSS attacks against the user's session cookie, set the session cookie to be HttpOnly. In browsers that support the HttpOnly feature (such as more recent versions of Internet Explorer and Firefox), this attribute can prevent the user's session cookie from being accessible to malicious client-side scripts that use document.cookie. This is not a complete solution, since HttpOnly is not supported by all browsers. More importantly, XMLHTTPRequest and other powerful browser technologies provide read access to HTTP headers, including the Set-Cookie header in which the HttpOnly flag is set.

Assume all input is malicious. Use an "accept known good" input validation strategy, i.e., use an allow list of acceptable inputs that strictly conform to specifications. Reject any input that does not strictly conform to specifications, or transform it into something that does. Do not rely exclusively on looking for malicious or malformed inputs (i.e., do not rely on a deny list). However, deny lists can be useful for detecting potential attacks or determining which inputs are so malformed that they should be rejected outright.

When performing input validation, consider all potentially relevant properties, including length, type of input, the full range of acceptable values, missing or extra inputs, syntax, consistency across related fields, and conformance to business rules. As an example of business rule logic, "boat" may be syntactically valid because it only contains alphanumeric characters, but it is not valid if you are expecting colors such as "red" or "blue."

Ensure that you perform input validation at well-defined interfaces within the application. This will help protect the application even if a component is reused or moved elsewhere.
	

### Reference


* [ https://owasp.org/www-community/attacks/xss/ ](https://owasp.org/www-community/attacks/xss/)
* [ https://cwe.mitre.org/data/definitions/79.html ](https://cwe.mitre.org/data/definitions/79.html)


#### CWE Id: [ 79 ](https://cwe.mitre.org/data/definitions/79.html)


#### WASC Id: 8

#### Source ID: 1

### [ Unexpected Content-Type was returned ](https://www.zaproxy.org/docs/alerts/100001/)



##### Low (High)

### Description

A Content-Type of text/html was returned by the server.
This is not one of the types expected to be returned by an API.
Raised by the 'Alert on Unexpected Content Types' script

* URL: http://localhost:8000/WEB-INF/applicationContext.xml
  * Node Name: `http://localhost:8000/WEB-INF/applicationContext.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/WEB-INF/classes/1/0.class
  * Node Name: `http://localhost:8000/WEB-INF/classes/1/0.class`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/WEB-INF/classes/BTgjxohI/css.class
  * Node Name: `http://localhost:8000/WEB-INF/classes/BTgjxohI/css.class`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/WEB-INF/classes/feb606b9/js.class
  * Node Name: `http://localhost:8000/WEB-INF/classes/feb606b9/js.class`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/WEB-INF/classes/fonts/googleapis/com.class
  * Node Name: `http://localhost:8000/WEB-INF/classes/fonts/googleapis/com.class`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/WEB-INF/classes/fonts/gstatic/com.class
  * Node Name: `http://localhost:8000/WEB-INF/classes/fonts/gstatic/com.class`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/WEB-INF/web.xml
  * Node Name: `http://localhost:8000/WEB-INF/web.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth
  * Node Name: `http://localhost:8000/auth`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/auth (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/
  * Node Name: `http://localhost:8000/auth/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/.env
  * Node Name: `http://localhost:8000/auth/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/.htaccess
  * Node Name: `http://localhost:8000/auth/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/login%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/auth/login (class.module.classLoader.DefaultAssertio...)({email,password})`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/logout%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/auth/logout (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/me
  * Node Name: `http://localhost:8000/auth/me`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/me%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/auth/me (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/me/
  * Node Name: `http://localhost:8000/auth/me/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/refresh%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/auth/refresh (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/trace.axd
  * Node Name: `http://localhost:8000/auth/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth
  * Node Name: `http://localhost:8000/auth ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/login
  * Node Name: `http://localhost:8000/auth/login ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/login
  * Node Name: `http://localhost:8000/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/login/
  * Node Name: `http://localhost:8000/auth/login/ ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/logout
  * Node Name: `http://localhost:8000/auth/logout`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/logout
  * Node Name: `http://localhost:8000/auth/logout ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/logout/
  * Node Name: `http://localhost:8000/auth/logout/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/me
  * Node Name: `http://localhost:8000/auth/me ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/refresh
  * Node Name: `http://localhost:8000/auth/refresh`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/refresh
  * Node Name: `http://localhost:8000/auth/refresh ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/refresh/
  * Node Name: `http://localhost:8000/auth/refresh/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/register
  * Node Name: `http://localhost:8000/auth/register ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:8000/auth/register/
  * Node Name: `http://localhost:8000/auth/register/ ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``


Instances: 32

### Solution



### Reference




#### Source ID: 4

### [ A Client Error response code was returned by the server ](https://www.zaproxy.org/docs/alerts/100000/)



##### Informational (High)

### Description

A response code of 400 was returned by the server.
This may indicate that the application is failing to handle unexpected input correctly.
Raised by the 'Alert on HTTP Response Code Error' script

* URL: http://localhost:8000/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members/member@example.com
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members/member@example.com`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members/member@example.com/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members/member@example.com/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/membership
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/membership`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/membership/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/membership/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/computeMetadata/v1/
  * Node Name: `http://localhost:8000/computeMetadata/v1/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://localhost:8000/computeMetadata/v1/
  * Node Name: `http://localhost:8000/computeMetadata/v1/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/latest/meta-data/
  * Node Name: `http://localhost:8000/latest/meta-data/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://localhost:8000/latest/meta-data/
  * Node Name: `http://localhost:8000/latest/meta-data/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/metadata/instance
  * Node Name: `http://localhost:8000/metadata/instance`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/metadata/v1
  * Node Name: `http://localhost:8000/metadata/v1`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/opc/v1/instance/
  * Node Name: `http://localhost:8000/opc/v1/instance/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://localhost:8000/opc/v1/instance/
  * Node Name: `http://localhost:8000/opc/v1/instance/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/opc/v2/instance/
  * Node Name: `http://localhost:8000/opc/v2/instance/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://localhost:8000/opc/v2/instance/
  * Node Name: `http://localhost:8000/opc/v2/instance/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/openstack/latest/meta_data.json
  * Node Name: `http://localhost:8000/openstack/latest/meta_data.json`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000
  * Node Name: `http://localhost:8000`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000%3Faaa=bbb
  * Node Name: `http://localhost:8000 (aaa)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000 (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/
  * Node Name: `http://localhost:8000/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/.DS_Store
  * Node Name: `http://localhost:8000/.DS_Store`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/._darcs
  * Node Name: `http://localhost:8000/._darcs`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/.bzr
  * Node Name: `http://localhost:8000/.bzr`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/.env
  * Node Name: `http://localhost:8000/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/.git/config
  * Node Name: `http://localhost:8000/.git/config`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/.hg
  * Node Name: `http://localhost:8000/.hg`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/.htaccess
  * Node Name: `http://localhost:8000/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/.idea/WebServers.xml
  * Node Name: `http://localhost:8000/.idea/WebServers.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/.php_cs.cache
  * Node Name: `http://localhost:8000/.php_cs.cache`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/.ssh/id_dsa
  * Node Name: `http://localhost:8000/.ssh/id_dsa`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/.ssh/id_rsa
  * Node Name: `http://localhost:8000/.ssh/id_rsa`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/.svn/entries
  * Node Name: `http://localhost:8000/.svn/entries`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/.svn/wc.db
  * Node Name: `http://localhost:8000/.svn/wc.db`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/.zap2151333527333581765
  * Node Name: `http://localhost:8000/.zap2151333527333581765`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/169092646663187522
  * Node Name: `http://localhost:8000/169092646663187522`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/BitKeeper
  * Node Name: `http://localhost:8000/BitKeeper`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/CHANGELOG.txt
  * Node Name: `http://localhost:8000/CHANGELOG.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/CVS/root
  * Node Name: `http://localhost:8000/CVS/root`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/DEADJOE
  * Node Name: `http://localhost:8000/DEADJOE`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/FileZilla.xml
  * Node Name: `http://localhost:8000/FileZilla.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/WS_FTP.INI
  * Node Name: `http://localhost:8000/WS_FTP.INI`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/WS_FTP.ini
  * Node Name: `http://localhost:8000/WS_FTP.ini`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/WinSCP.ini
  * Node Name: `http://localhost:8000/WinSCP.ini`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/_framework/blazor.boot.json
  * Node Name: `http://localhost:8000/_framework/blazor.boot.json`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/_wpeprivate/config.json
  * Node Name: `http://localhost:8000/_wpeprivate/config.json`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/adminer.php
  * Node Name: `http://localhost:8000/adminer.php`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api
  * Node Name: `http://localhost:8000/api`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/
  * Node Name: `http://localhost:8000/api/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/.env
  * Node Name: `http://localhost:8000/api/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/.htaccess
  * Node Name: `http://localhost:8000/api/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/7935344329824204590
  * Node Name: `http://localhost:8000/api/7935344329824204590`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/.env
  * Node Name: `http://localhost:8000/api/chats/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/.htaccess
  * Node Name: `http://localhost:8000/api/chats/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/1839106942508757890
  * Node Name: `http://localhost:8000/api/chats/1839106942508757890`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/actuator/health
  * Node Name: `http://localhost:8000/api/chats/actuator/health`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000 (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000 (class.module.classLoader.DefaultAssertio...)({title,model,reasoning,webFetch})`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/.env
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/.htaccess
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/4925679457165797798
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/4925679457165797798`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members (class.module.classLoader.DefaultAssertio...)({email})`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members/.env
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members/.htaccess
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members/9149924712412165513
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members/9149924712412165513`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members/member@example.com%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members/member@example.com (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members/trace.axd
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/membership%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/membership (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages (class.module.classLoader.DefaultAssertio...)({content,attachmentIds:[]})`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/.env
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/.htaccess
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/4811639802357092566
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/4811639802357092566`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001 (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001 (class.module.classLoader.DefaultAssertio...)({content})`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/.env
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/.htaccess
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/579474626636818132
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/579474626636818132`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments (class.module.classLoader.DefaultAssertio...)(multipart:file)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/trace.axd
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/trace.axd
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/stop%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/stop (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/trace.axd
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/trace.axd
  * Node Name: `http://localhost:8000/api/chats/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/trace.axd
  * Node Name: `http://localhost:8000/api/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/app/etc/local.xml
  * Node Name: `http://localhost:8000/app/etc/local.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/auth
  * Node Name: `http://localhost:8000/auth`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/auth
  * Node Name: `http://localhost:8000/auth`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/auth (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/
  * Node Name: `http://localhost:8000/auth/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/.env
  * Node Name: `http://localhost:8000/auth/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/.htaccess
  * Node Name: `http://localhost:8000/auth/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/1707693174031029430
  * Node Name: `http://localhost:8000/auth/1707693174031029430`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/auth/login%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/auth/login (class.module.classLoader.DefaultAssertio...)({email,password})`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/logout%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/auth/logout (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/me
  * Node Name: `http://localhost:8000/auth/me`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/me%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/auth/me (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/me/
  * Node Name: `http://localhost:8000/auth/me/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/refresh%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/auth/refresh (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/trace.axd
  * Node Name: `http://localhost:8000/auth/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/composer.json
  * Node Name: `http://localhost:8000/composer.json`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/composer.lock
  * Node Name: `http://localhost:8000/composer.lock`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/config/database.yml
  * Node Name: `http://localhost:8000/config/database.yml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/config/databases.yml
  * Node Name: `http://localhost:8000/config/databases.yml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/core
  * Node Name: `http://localhost:8000/core`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/elmah.axd
  * Node Name: `http://localhost:8000/elmah.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/filezilla.xml
  * Node Name: `http://localhost:8000/filezilla.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/i.php
  * Node Name: `http://localhost:8000/i.php`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/id_dsa
  * Node Name: `http://localhost:8000/id_dsa`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/id_rsa
  * Node Name: `http://localhost:8000/id_rsa`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/info.php
  * Node Name: `http://localhost:8000/info.php`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/key.pem
  * Node Name: `http://localhost:8000/key.pem`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/lfm.php
  * Node Name: `http://localhost:8000/lfm.php`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/myserver.key
  * Node Name: `http://localhost:8000/myserver.key`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/phpinfo.php
  * Node Name: `http://localhost:8000/phpinfo.php`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/privatekey.key
  * Node Name: `http://localhost:8000/privatekey.key`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/server-info
  * Node Name: `http://localhost:8000/server-info`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/server-status
  * Node Name: `http://localhost:8000/server-status`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/server.key
  * Node Name: `http://localhost:8000/server.key`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/sftp-config.json
  * Node Name: `http://localhost:8000/sftp-config.json`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/sitemanager.xml
  * Node Name: `http://localhost:8000/sitemanager.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/sites/default/files/.ht.sqlite
  * Node Name: `http://localhost:8000/sites/default/files/.ht.sqlite`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/sites/default/private/files/backup_migrate/scheduled/test.txt
  * Node Name: `http://localhost:8000/sites/default/private/files/backup_migrate/scheduled/test.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/test.php
  * Node Name: `http://localhost:8000/test.php`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/trace.axd
  * Node Name: `http://localhost:8000/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/vb_test.php
  * Node Name: `http://localhost:8000/vb_test.php`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/vim_settings.xml
  * Node Name: `http://localhost:8000/vim_settings.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/winscp.ini
  * Node Name: `http://localhost:8000/winscp.ini`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/ws_ftp.ini
  * Node Name: `http://localhost:8000/ws_ftp.ini`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/zap7498493972413404712
  * Node Name: `http://localhost:8000/zap7498493972413404712`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000 ()({title,model,reasoning,webFetch})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000 ()({title,model,reasoning,webFetch})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/ ()({title,model,reasoning,webFetch})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001 ()({content})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/ ()({content})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000
  * Node Name: `http://localhost:8000 ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/ (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/ (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api
  * Node Name: `http://localhost:8000/api ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats
  * Node Name: `http://localhost:8000/api/chats ()(aaa)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats
  * Node Name: `http://localhost:8000/api/chats ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats
  * Node Name: `http://localhost:8000/api/chats ()({title,provider,model,reasoning,webFetch})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000 ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000 ()(multipart:1,0)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000 (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000 (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members ()(aaa)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members ()({email})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members ()({email})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members/ ()({email})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members/member@example.com
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members/member@example.com ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members/member@example.com%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members/member@example.com (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members/member@example.com%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members/member@example.com (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/membership
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/membership ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/membership%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/membership (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/membership%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/membership (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages ()(aaa)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages ()({content,attachmentIds:[]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/ ()({content,attachmentIds:[]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001 ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001 (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001 (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments ()(aaa)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments ()(multipart:file)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments ()(multipart:file)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments/ ()(multipart:file)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/stop
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/stop`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/stop
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/stop ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/stop%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/stop (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/stop%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/stop (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/stop/
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/stop/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/auth
  * Node Name: `http://localhost:8000/auth ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/auth (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/auth%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/auth (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/auth/login
  * Node Name: `http://localhost:8000/auth/login ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/login
  * Node Name: `http://localhost:8000/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:8000/auth/login
  * Node Name: `http://localhost:8000/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/login%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/auth/login (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:8000/auth/login%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/auth/login (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:8000/auth/login/
  * Node Name: `http://localhost:8000/auth/login/ ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/logout
  * Node Name: `http://localhost:8000/auth/logout`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/logout
  * Node Name: `http://localhost:8000/auth/logout ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/logout/
  * Node Name: `http://localhost:8000/auth/logout/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/me
  * Node Name: `http://localhost:8000/auth/me ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/me%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/auth/me (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/auth/me%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/auth/me (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/auth/refresh
  * Node Name: `http://localhost:8000/auth/refresh`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:8000/auth/refresh
  * Node Name: `http://localhost:8000/auth/refresh`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/refresh
  * Node Name: `http://localhost:8000/auth/refresh ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/refresh%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/auth/refresh (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:8000/auth/refresh%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/auth/refresh (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:8000/auth/refresh/
  * Node Name: `http://localhost:8000/auth/refresh/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/register
  * Node Name: `http://localhost:8000/auth/register ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/auth/register
  * Node Name: `http://localhost:8000/auth/register ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `409`
  * Other Info: ``
* URL: http://localhost:8000/auth/register
  * Node Name: `http://localhost:8000/auth/register ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://localhost:8000/auth/register%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/auth/register (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo g5l3j47xny6w...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/auth/register%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/auth/register (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo g5l3j47xny6wnifdl8du',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/auth/register/
  * Node Name: `http://localhost:8000/auth/register/ ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``


Instances: 230

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

### [ Authentication Request Identified ](https://www.zaproxy.org/docs/alerts/10111/)



##### Informational (High)

### Description

The given request has been identified as an authentication request. The 'Other Info' field contains a set of key=value lines which identify any relevant fields. If the request is in a context which has an Authentication Method set to "Auto-Detect" then this rule will change the authentication to match the request identified.

* URL: http://localhost:8000/auth/login
  * Node Name: `http://localhost:8000/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: `email`
  * Attack: ``
  * Evidence: `password`
  * Other Info: `userParam=email
userValue=zaproxy@example.com
passwordParam=password`


Instances: 1

### Solution

This is an informational alert rather than a vulnerability and so there is nothing to fix.

### Reference


* [ https://www.zaproxy.org/docs/desktop/addons/authentication-helper/auth-req-id/ ](https://www.zaproxy.org/docs/desktop/addons/authentication-helper/auth-req-id/)



#### Source ID: 3

### [ Non-Storable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are not storable by caching components such as proxy servers. If the response does not contain sensitive, personal or user-specific information, it may benefit from being stored and cached, to improve performance.

* URL: http://localhost:8000/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `DELETE `
  * Other Info: ``
* URL: http://localhost:8000/api/chats
  * Node Name: `http://localhost:8000/api/chats ()({title,provider,model,reasoning,webFetch})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `201`
  * Other Info: ``
* URL: http://localhost:8000/auth/login
  * Node Name: `http://localhost:8000/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:8000/auth/refresh
  * Node Name: `http://localhost:8000/auth/refresh`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://localhost:8000/auth/register
  * Node Name: `http://localhost:8000/auth/register ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``

Instances: Systemic


### Solution

The content may be marked as storable by ensuring that the following conditions are satisfied:
The request method must be understood by the cache and defined as being cacheable ("GET", "HEAD", and "POST" are currently defined as cacheable)
The response status code must be understood by the cache (one of the 1XX, 2XX, 3XX, 4XX, or 5XX response classes are generally understood)
The "no-store" cache directive must not appear in the request or response header fields
For caching by "shared" caches such as "proxy" caches, the "private" response directive must not appear in the response
For caching by "shared" caches such as "proxy" caches, the "Authorization" header field must not appear in the request, unless the response explicitly allows it (using one of the "must-revalidate", "public", or "s-maxage" Cache-Control response directives)
In addition to the conditions above, at least one of the following conditions must also be satisfied by the response:
It must contain an "Expires" header field
It must contain a "max-age" response directive
For "shared" caches such as "proxy" caches, it must contain a "s-maxage" response directive
It must contain a "Cache Control Extension" that allows it to be cached
It must have a status code that is defined as cacheable by default (200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501).

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3

### [ Storable and Cacheable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are storable by caching components such as proxy servers, and may be retrieved directly from the cache, rather than from the origin server by the caching servers, in response to similar requests from other users. If the response data is sensitive, personal or user-specific, this may result in sensitive information being leaked. In some cases, this may even result in a user gaining complete control of the session of another user, depending on the configuration of the caching components in use in their environment. This is primarily an issue where "shared" caching servers such as "proxy" caches are configured on the local network. This configuration is typically found in corporate or educational environments, for instance.

* URL: http://localhost:8000/api/chats
  * Node Name: `http://localhost:8000/api/chats`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`
* URL: http://localhost:8000/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`
* URL: http://localhost:8000/auth/me
  * Node Name: `http://localhost:8000/auth/me`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`
* URL: http://localhost:8000/auth/logout
  * Node Name: `http://localhost:8000/auth/logout`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`


Instances: 5

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

### [ User Agent Fuzzer ](https://www.zaproxy.org/docs/alerts/10104/)



##### Informational (Medium)

### Description

Check for differences in response based on fuzzed User Agent (eg. mobile sites, access as a Search Engine Crawler). Compares the response statuscode and the hashcode of the response body with the original response.

* URL: http://localhost:8000/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000`
  * Method: `DELETE`
  * Parameter: `Header User-Agent`
  * Attack: `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)`
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:8000/api/chats/cm0example0000000000000000/members/member@example.com
  * Node Name: `http://localhost:8000/api/chats/cm0example0000000000000000/members/member@example.com`
  * Method: `DELETE`
  * Parameter: `Header User-Agent`
  * Attack: `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)`
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:8000/auth/logout
  * Node Name: `http://localhost:8000/auth/logout`
  * Method: `POST`
  * Parameter: `Header User-Agent`
  * Attack: `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)`
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:8000/auth/refresh
  * Node Name: `http://localhost:8000/auth/refresh`
  * Method: `POST`
  * Parameter: `Header User-Agent`
  * Attack: `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)`
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:8000/auth/register
  * Node Name: `http://localhost:8000/auth/register ()({email,password})`
  * Method: `POST`
  * Parameter: `Header User-Agent`
  * Attack: `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)`
  * Evidence: ``
  * Other Info: ``

Instances: Systemic


### Solution



### Reference


* [ https://owasp.org/wstg ](https://owasp.org/wstg)



#### Source ID: 1


