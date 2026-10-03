# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 0 |
| Low | 1 |
| Informational | 5 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Low | Warning |  | ZAP warnings logged - see the zap.log file for details | 63    |
| Low | Exceeded High | http://localhost:8000 | Percentage of responses with status code 4xx | 97 % |
| Info | Informational |  | Percentage of network failures | 1 % |
| Info | Informational | http://localhost:3001 | Percentage of responses with status code 2xx | 100 % |
| Info | Informational | http://localhost:3001 | Percentage of endpoints with content type text/javascript | 100 % |
| Info | Informational | http://localhost:3001 | Percentage of endpoints with method GET | 100 % |
| Info | Informational | http://localhost:3001 | Count of total endpoints | 7    |
| Info | Informational | http://localhost:3001 | Percentage of slow responses | 14 % |
| Info | Informational | http://localhost:3002 | Percentage of responses with status code 2xx | 100 % |
| Info | Informational | http://localhost:3002 | Percentage of endpoints with content type text/javascript | 100 % |
| Info | Informational | http://localhost:3002 | Percentage of endpoints with method GET | 100 % |
| Info | Informational | http://localhost:3002 | Count of total endpoints | 7    |
| Info | Informational | http://localhost:3002 | Percentage of slow responses | 28 % |
| Info | Informational | http://localhost:3003 | Percentage of responses with status code 2xx | 100 % |
| Info | Informational | http://localhost:3003 | Percentage of endpoints with content type text/javascript | 100 % |
| Info | Informational | http://localhost:3003 | Percentage of endpoints with method GET | 100 % |
| Info | Informational | http://localhost:3003 | Count of total endpoints | 7    |
| Info | Informational | http://localhost:3003 | Percentage of slow responses | 28 % |
| Info | Informational | http://localhost:8000 | Percentage of responses with status code 2xx | 2 % |
| Info | Informational | http://localhost:8000 | Percentage of endpoints with content type application/json | 68 % |
| Info | Informational | http://localhost:8000 | Percentage of endpoints with content type text/css | 1 % |
| Info | Informational | http://localhost:8000 | Percentage of endpoints with content type text/html | 2 % |
| Info | Informational | http://localhost:8000 | Percentage of endpoints with content type text/javascript | 5 % |
| Info | Informational | http://localhost:8000 | Percentage of endpoints with method DELETE | 5 % |
| Info | Informational | http://localhost:8000 | Percentage of endpoints with method GET | 64 % |
| Info | Informational | http://localhost:8000 | Percentage of endpoints with method PATCH | 1 % |
| Info | Informational | http://localhost:8000 | Percentage of endpoints with method POST | 28 % |
| Info | Informational | http://localhost:8000 | Count of total endpoints | 288    |
| Info | Informational | https://fonts.googleapis.com | Percentage of responses with status code 2xx | 100 % |
| Info | Informational | https://fonts.googleapis.com | Percentage of endpoints with content type text/css | 100 % |
| Info | Informational | https://fonts.googleapis.com | Percentage of endpoints with method GET | 100 % |
| Info | Informational | https://fonts.googleapis.com | Count of total endpoints | 1    |
| Info | Informational | https://fonts.googleapis.com | Percentage of slow responses | 100 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Unexpected Content-Type was returned | Low | 46 |
| A Client Error response code was returned by the server | Informational | 273 |
| Authentication Request Identified | Informational | 1 |
| Non-Storable Content | Informational | 2 |
| Storable and Cacheable Content | Informational | Systemic |
| User Agent Fuzzer | Informational | Systemic |




## Alert Detail



### [ Unexpected Content-Type was returned ](https://www.zaproxy.org/docs/alerts/100001/)



##### Low (High)

### Description

A Content-Type of text/html was returned by the server.
This is not one of the types expected to be returned by an API.
Raised by the 'Alert on Unexpected Content Types' script

* URL: http://localhost:3001/assets/_virtual_mf-localSharedImportMap___mfe_internal__mfeAuth__mf_owner__1-ayaWk-Jh.js
  * Node Name: `http://localhost:3001/assets/_virtual_mf-localSharedImportMap___mfe_internal__mfeAuth__mf_owner__1-ayaWk-Jh.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3001/assets/dist-DZe0u63M.js
  * Node Name: `http://localhost:3001/assets/dist-DZe0u63M.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3001/assets/helpers-ErDYAcao.js
  * Node Name: `http://localhost:3001/assets/helpers-ErDYAcao.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3001/assets/rolldown-runtime-B0Z9INg1.js
  * Node Name: `http://localhost:3001/assets/rolldown-runtime-B0Z9INg1.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3001/assets/utils-mzYn9uaX.js
  * Node Name: `http://localhost:3001/assets/utils-mzYn9uaX.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3001/assets/vite-preload-helper-bTxWVuPN.js
  * Node Name: `http://localhost:3001/assets/vite-preload-helper-bTxWVuPN.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3001/remoteEntry.js
  * Node Name: `http://localhost:3001/remoteEntry.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3002/assets/_virtual_mf-localSharedImportMap___mfe_internal__mfe_chat__mf_owner__1-BeFGZYJ3.js
  * Node Name: `http://localhost:3002/assets/_virtual_mf-localSharedImportMap___mfe_internal__mfe_chat__mf_owner__1-BeFGZYJ3.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3002/assets/dist-DZe0u63M.js
  * Node Name: `http://localhost:3002/assets/dist-DZe0u63M.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3002/assets/helpers-ErDYAcao.js
  * Node Name: `http://localhost:3002/assets/helpers-ErDYAcao.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3002/assets/rolldown-runtime-B0Z9INg1.js
  * Node Name: `http://localhost:3002/assets/rolldown-runtime-B0Z9INg1.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3002/assets/utils-mzYn9uaX.js
  * Node Name: `http://localhost:3002/assets/utils-mzYn9uaX.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3002/assets/vite-preload-helper-bTxWVuPN.js
  * Node Name: `http://localhost:3002/assets/vite-preload-helper-bTxWVuPN.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3002/remoteEntry.js
  * Node Name: `http://localhost:3002/remoteEntry.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3003/assets/_virtual_mf-localSharedImportMap___mfe_internal__mfeSettings__mf_owner__1-DOFRK3az.js
  * Node Name: `http://localhost:3003/assets/_virtual_mf-localSharedImportMap___mfe_internal__mfeSettings__mf_owner__1-DOFRK3az.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3003/assets/dist-DZe0u63M.js
  * Node Name: `http://localhost:3003/assets/dist-DZe0u63M.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3003/assets/helpers-ErDYAcao.js
  * Node Name: `http://localhost:3003/assets/helpers-ErDYAcao.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3003/assets/rolldown-runtime-B0Z9INg1.js
  * Node Name: `http://localhost:3003/assets/rolldown-runtime-B0Z9INg1.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3003/assets/utils-mzYn9uaX.js
  * Node Name: `http://localhost:3003/assets/utils-mzYn9uaX.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3003/assets/vite-preload-helper-bTxWVuPN.js
  * Node Name: `http://localhost:3003/assets/vite-preload-helper-bTxWVuPN.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:3003/remoteEntry.js
  * Node Name: `http://localhost:3003/remoteEntry.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/
  * Node Name: `http://localhost:8000/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
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
* URL: http://localhost:8000/assets/_virtual_mf-localSharedImportMap___mfe_internal__shell__mf_owner__1-CVY2nkq2.js
  * Node Name: `http://localhost:8000/assets/_virtual_mf-localSharedImportMap___mfe_internal__shell__mf_owner__1-CVY2nkq2.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/assets/_virtual_mf___mfe_internal__shell__mf_owner__180295816046911__loadShare___mf_0_tanstack_mf_1_react_mf_2_query__loadShare__.js-D01sXRRD.js
  * Node Name: `http://localhost:8000/assets/_virtual_mf___mfe_internal__shell__mf_owner__180295816046911__loadShare___mf_0_tanstack_mf_1_react_mf_2_query__loadShare__.js-D01sXRRD.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/assets/_virtual_mf___mfe_internal__shell__mf_owner__180295816046911__loadShare___mf_0_tanstack_mf_1_react_mf_2_router__loadShare__.js-_hrXoEyd.js
  * Node Name: `http://localhost:8000/assets/_virtual_mf___mfe_internal__shell__mf_owner__180295816046911__loadShare___mf_0_tanstack_mf_1_react_mf_2_router__loadShare__.js-_hrXoEyd.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/assets/_virtual_mf___mfe_internal__shell__mf_owner__180295816046911__loadShare__react_mf_2_dom__loadShare__.js-DZkEGG3o.js
  * Node Name: `http://localhost:8000/assets/_virtual_mf___mfe_internal__shell__mf_owner__180295816046911__loadShare__react_mf_2_dom__loadShare__.js-DZkEGG3o.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/assets/_virtual_mf___mfe_internal__shell__mf_owner__180295816046911__loadShare__react_mf_2_dom_mf_1_client__loadShare__.js-y63sHyEv.js
  * Node Name: `http://localhost:8000/assets/_virtual_mf___mfe_internal__shell__mf_owner__180295816046911__loadShare__react_mf_2_dom_mf_1_client__loadShare__.js-y63sHyEv.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/assets/createLucideIcon-Cc4AVgmL.js
  * Node Name: `http://localhost:8000/assets/createLucideIcon-Cc4AVgmL.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/assets/dist-CLIfLqvQ.js
  * Node Name: `http://localhost:8000/assets/dist-CLIfLqvQ.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/assets/dist-VJ_v_pyo.js
  * Node Name: `http://localhost:8000/assets/dist-VJ_v_pyo.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/assets/helpers-CeEy7IUA.js
  * Node Name: `http://localhost:8000/assets/helpers-CeEy7IUA.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/assets/hostInit-D-RSq0fB.js
  * Node Name: `http://localhost:8000/assets/hostInit-D-RSq0fB.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/assets/index-BTgjxohI.css
  * Node Name: `http://localhost:8000/assets/index-BTgjxohI.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/css`
  * Other Info: ``
* URL: http://localhost:8000/assets/mf-entry-bootstrap-0-feb606b9.js
  * Node Name: `http://localhost:8000/assets/mf-entry-bootstrap-0-feb606b9.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/assets/rolldown-runtime-B0Z9INg1.js
  * Node Name: `http://localhost:8000/assets/rolldown-runtime-B0Z9INg1.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/assets/utils-YCEgqyCG.js
  * Node Name: `http://localhost:8000/assets/utils-YCEgqyCG.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/assets/vite-preload-helper-B3nfOi5I.js
  * Node Name: `http://localhost:8000/assets/vite-preload-helper-B3nfOi5I.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: http://localhost:8000/remoteEntry.js
  * Node Name: `http://localhost:8000/remoteEntry.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/javascript`
  * Other Info: ``
* URL: https://fonts.googleapis.com/css2%3Ffamily=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap
  * Node Name: `https://fonts.googleapis.com/css2 (display,family,family)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/css`
  * Other Info: ``


Instances: 46

### Solution



### Reference




#### Source ID: 4

### [ A Client Error response code was returned by the server ](https://www.zaproxy.org/docs/alerts/100000/)



##### Informational (High)

### Description

A response code of 404 was returned by the server.
This may indicate that the application is failing to handle unexpected input correctly.
Raised by the 'Alert on HTTP Response Code Error' script

* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/`
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
* URL: http://localhost:8000/.zap7489843599946276394
  * Node Name: `http://localhost:8000/.zap7489843599946276394`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/6138332625923732704
  * Node Name: `http://localhost:8000/6138332625923732704`
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
* URL: http://localhost:8000/api%3Fname=abc
  * Node Name: `http://localhost:8000/api (name)`
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
* URL: http://localhost:8000/api/5076124016492858104
  * Node Name: `http://localhost:8000/api/5076124016492858104`
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
* URL: http://localhost:8000/api/chats/8568855732056654017
  * Node Name: `http://localhost:8000/api/chats/8568855732056654017`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api
  * Node Name: `http://localhost:8000/api/chats/api`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/api (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/
  * Node Name: `http://localhost:8000/api/chats/api/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/.env
  * Node Name: `http://localhost:8000/api/chats/api/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/.htaccess
  * Node Name: `http://localhost:8000/api/chats/api/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/7555061156892546331
  * Node Name: `http://localhost:8000/api/chats/api/7555061156892546331`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats
  * Node Name: `http://localhost:8000/api/chats/api/chats`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats (class.module.classLoader.DefaultAssertio...)({title,provider,model,reasoning,webFetch})`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/api/chats (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/
  * Node Name: `http://localhost:8000/api/chats/api/chats/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/.env
  * Node Name: `http://localhost:8000/api/chats/api/chats/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/.htaccess
  * Node Name: `http://localhost:8000/api/chats/api/chats/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/635616154438384259
  * Node Name: `http://localhost:8000/api/chats/api/chats/635616154438384259`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/actuator/health
  * Node Name: `http://localhost:8000/api/chats/api/chats/actuator/health`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000 (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000 (class.module.classLoader.DefaultAssertio...)({title,model,reasoning,webFetch})`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000 (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/.env
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/.htaccess
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/318815392073807757
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/318815392073807757`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members (class.module.classLoader.DefaultAssertio...)({email})`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/.env
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/.htaccess
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/5352152536385244725
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/5352152536385244725`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/trace.axd
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages (class.module.classLoader.DefaultAssertio...)({content,attachmentIds:[]})`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/.env
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/.htaccess
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/2015696079616334422
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/2015696079616334422`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001 (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001 (class.module.classLoader.DefaultAssertio...)({content})`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001 (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/.env
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/.htaccess
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/5588273347120242136
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/5588273347120242136`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments (class.module.classLoader.DefaultAssertio...)(multipart:file)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/trace.axd
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/trace.axd
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/trace.axd
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/trace.axd
  * Node Name: `http://localhost:8000/api/chats/api/chats/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/trace.axd
  * Node Name: `http://localhost:8000/api/chats/api/trace.axd`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth
  * Node Name: `http://localhost:8000/api/chats/auth`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/auth (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/auth (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/
  * Node Name: `http://localhost:8000/api/chats/auth/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/.env
  * Node Name: `http://localhost:8000/api/chats/auth/.env`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/.htaccess
  * Node Name: `http://localhost:8000/api/chats/auth/.htaccess`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/8438439942353217264
  * Node Name: `http://localhost:8000/api/chats/auth/8438439942353217264`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/login
  * Node Name: `http://localhost:8000/api/chats/auth/login`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/login%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/auth/login (class.module.classLoader.DefaultAssertio...)({email,password})`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/login%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/auth/login (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/logout
  * Node Name: `http://localhost:8000/api/chats/auth/logout`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/logout%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/auth/logout (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/logout%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/auth/logout (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/me
  * Node Name: `http://localhost:8000/api/chats/auth/me`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/me%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/auth/me (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/me%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/auth/me (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/me/
  * Node Name: `http://localhost:8000/api/chats/auth/me/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/refresh
  * Node Name: `http://localhost:8000/api/chats/auth/refresh`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/refresh%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/auth/refresh (class.module.classLoader.DefaultAssertio...)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/refresh%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/auth/refresh (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/register
  * Node Name: `http://localhost:8000/api/chats/auth/register`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/register%3Fclass.module.classLoader.DefaultAssertionStatus=nonsense
  * Node Name: `http://localhost:8000/api/chats/auth/register (class.module.classLoader.DefaultAssertio...)({email,password})`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/register%3Fname=abc
  * Node Name: `http://localhost:8000/api/chats/auth/register (name)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/trace.axd
  * Node Name: `http://localhost:8000/api/chats/auth/trace.axd`
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
* URL: http://localhost:8000/favicon.ico
  * Node Name: `http://localhost:8000/favicon.ico`
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
* URL: http://localhost:8000/zap8957442621241650730
  * Node Name: `http://localhost:8000/zap8957442621241650730`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000 ()({title,model,reasoning,webFetch})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/ ()({title,model,reasoning,webFetch})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001 ()({content})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/ ()({content})`
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
  * Node Name: `http://localhost:8000/ (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/ (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
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
  * Node Name: `http://localhost:8000/api (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
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
* URL: http://localhost:8000/api/chats%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api
  * Node Name: `http://localhost:8000/api/chats/api ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats
  * Node Name: `http://localhost:8000/api/chats/api/chats ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats
  * Node Name: `http://localhost:8000/api/chats/api/chats ()({title,provider,model,reasoning,webFetch})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/
  * Node Name: `http://localhost:8000/api/chats/api/chats/ ()({title,provider,model,reasoning,webFetch})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000 ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000 ()(multipart:1,0)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000 (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000 (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members ()({email})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/ ()({email})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages ()({content,attachmentIds:[]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/ ()({content,attachmentIds:[]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001 ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001 (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001 (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments ()(multipart:file)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments ()(multipart:rtobject)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments/ ()(multipart:file)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/retry/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop/
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth
  * Node Name: `http://localhost:8000/api/chats/auth ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/auth (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/auth (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/login
  * Node Name: `http://localhost:8000/api/chats/auth/login ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/login
  * Node Name: `http://localhost:8000/api/chats/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/login%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/auth/login (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/login%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/auth/login (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/login/
  * Node Name: `http://localhost:8000/api/chats/auth/login/ ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/logout
  * Node Name: `http://localhost:8000/api/chats/auth/logout`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/logout
  * Node Name: `http://localhost:8000/api/chats/auth/logout ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/logout%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/auth/logout (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/logout%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/auth/logout (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/logout/
  * Node Name: `http://localhost:8000/api/chats/auth/logout/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/me
  * Node Name: `http://localhost:8000/api/chats/auth/me ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/me%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/auth/me (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/me%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/auth/me (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/refresh
  * Node Name: `http://localhost:8000/api/chats/auth/refresh`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/refresh
  * Node Name: `http://localhost:8000/api/chats/auth/refresh ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/refresh%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/auth/refresh (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/refresh%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/auth/refresh (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/refresh/
  * Node Name: `http://localhost:8000/api/chats/auth/refresh/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/register
  * Node Name: `http://localhost:8000/api/chats/auth/register ()(class.module.classLoader.DefaultAssertio...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/register
  * Node Name: `http://localhost:8000/api/chats/auth/register ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/register%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/auth/register (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('cmd.exe /C echo 0v4mlfujibgt...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/register%3F-d+allow_url_include%253d1+-d+auto_prepend_file%253dphp://input
  * Node Name: `http://localhost:8000/api/chats/auth/register (-d allow_url_include=1 -d auto_prepend_f...)(<?php exec('echo 0v4mlfujibgt22dvb5b6',$...)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:8000/api/chats/auth/register/
  * Node Name: `http://localhost:8000/api/chats/auth/register/ ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``


Instances: 273

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

### [ Authentication Request Identified ](https://www.zaproxy.org/docs/alerts/10111/)



##### Informational (High)

### Description

The given request has been identified as an authentication request. The 'Other Info' field contains a set of key=value lines which identify any relevant fields. If the request is in a context which has an Authentication Method set to "Auto-Detect" then this rule will change the authentication to match the request identified.

* URL: http://localhost:8000/api/chats/auth/login
  * Node Name: `http://localhost:8000/api/chats/auth/login ()({email,password})`
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

* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `DELETE `
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `DELETE `
  * Other Info: ``


Instances: 2

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

* URL: http://localhost:8000/api/chats/api/chats
  * Node Name: `http://localhost:8000/api/chats/api/chats`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`
* URL: http://localhost:8000/api/chats/auth/me
  * Node Name: `http://localhost:8000/api/chats/auth/me`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`
* URL: http://localhost:8000/api/chats/api/chats
  * Node Name: `http://localhost:8000/api/chats/api/chats ()({title,provider,model,reasoning,webFetch})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`
* URL: http://localhost:8000/api/chats/auth/login
  * Node Name: `http://localhost:8000/api/chats/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`
* URL: http://localhost:8000/api/chats/auth/register
  * Node Name: `http://localhost:8000/api/chats/auth/register ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`

Instances: Systemic


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

* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000`
  * Method: `DELETE`
  * Parameter: `Header User-Agent`
  * Attack: `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)`
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/members/member@example.com`
  * Method: `DELETE`
  * Parameter: `Header User-Agent`
  * Attack: `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)`
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/membership`
  * Method: `DELETE`
  * Parameter: `Header User-Agent`
  * Attack: `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)`
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/messages/cm0example0000000000000001/attachments ()(multipart:file)`
  * Method: `POST`
  * Parameter: `Header User-Agent`
  * Attack: `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)`
  * Evidence: ``
  * Other Info: ``
* URL: http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop
  * Node Name: `http://localhost:8000/api/chats/api/chats/cm0example0000000000000000/stop`
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


