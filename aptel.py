import requests
from bs4 import BeautifulSoup

from .search import ConciseJson, Order, SearchResultData


def get_all_cases_by_dfr(dfr, year):
    url = "https://aptel.gov.in/casestatusapi"

    cookie = requests.get("https://aptel.gov.in/casestatusapi").headers["Set-Cookie"]

    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.7",
        "Cache-Control": "max-age=0",
        "Content-Type": "multipart/form-data; boundary=----WebKitFormBoundaryxDawSpzHsWcOXQrL",
        "Sec-Ch-Ua": '"Chromium";v="124", "Brave";v="124", "Not-A.Brand";v="99"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Sec-Gpc": "1",
        "Upgrade-Insecure-Requests": "1",
        "Cookie": f"has_js=1; {cookie}",
        "Referer": "https://aptel.gov.in/casestatusapi",
        "Referrer-Policy": "strict-origin-when-cross-origin",
    }

    body = f'------WebKitFormBoundaryxDawSpzHsWcOXQrL\r\nContent-Disposition: form-data; name="diary_no"\r\n\r\n{dfr}\r\n------WebKitFormBoundaryxDawSpzHsWcOXQrL\r\nContent-Disposition: form-data; name="diary_year"\r\n\r\n{year}\r\n------WebKitFormBoundaryxDawSpzHsWcOXQrL\r\nContent-Disposition: form-data; name="submit"\r\n\r\nSubmit\r\n------WebKitFormBoundaryxDawSpzHsWcOXQrL--\r\n'

    response = requests.post(url, headers=headers, data=body)
    soup = BeautifulSoup(response.text)

    data = []
    tables = soup.find("table", class_="table")

    if tables is None:
        get_all_cases_by_dfr(dfr, year)

    rows = tables.find_all("tr")
    for r in rows[1:]:
        td = r.find_all("td")
        search_model = SearchResultData(
            cino=td[1].find("a").get("href").split("/")[-1],
            case_no=td[1].text.strip(),
            date_of_decision=td[4].text.strip(),
            pet_name=td[3].text.split("Vs")[0].strip(),
            res_name=td[3].text.split("Vs")[1].strip(),
            type_name="APTEL",
        )
        data.append(search_model)

    return data


# Individual Case
def get_case_data(case_no):
    single_case_url = f"https://aptel.gov.in/caseapidetails/{case_no}"
    single_case_headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.7",
        "Cache-Control": "max-age=0",
        "Sec-Ch-Ua": '"Chromium";v="124", "Brave";v="124", "Not-A.Brand";v="99"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Sec-Gpc": "1",
        "Upgrade-Insecure-Requests": "1",
        "Cookie": "has_js=1; SSESSaaf63c77d79791df2cb8f57bcb0ddec5=olNzdbvkv4zmkJ3QEjw8girEONrLbYAI1Mr4oa92HkQ",
        "Referer": "https://aptel.gov.in/casestatusapi/tab3",
        "Referrer-Policy": "strict-origin-when-cross-origin",
    }

    single_case_response = requests.get(single_case_url, headers=single_case_headers)
    soup = BeautifulSoup(single_case_response.text, "lxml")

    tr = soup.find_all("tr")
    model = ConciseJson(
        case_no=tr[2].find_all("td")[-1].text.strip()
        if tr[2] and tr[2].find_all("td")
        else "",
        filing_date=tr[3].find_all("td")[-1].text.strip()
        if tr[3] and tr[3].find_all("td")
        else "",
        disposal_nature=0
        if tr[4]
        and tr[4].find_all("td")
        and tr[4].find_all("td")[-1].text.strip() == "Pending"
        else 1,
        bench_name=tr[6].find_all("td")[-1].text.strip()
        if tr[6] and tr[6].find_all("td")
        else "",
        next_listing_date=tr[8].find_all("td")[-1].text.strip()
        if tr[8] and tr[8].find_all("td")
        else "",
        petitioner=tr[14].find_all("td")[-1].text.strip()
        if tr[14] and tr[14].find_all("td")
        else "",
        petitioner_advocates=tr[16].find_all("td")[-1].text.strip()
        if tr[16] and tr[16].find_all("td")
        else "",
        respondent=tr[19].find_all("td")[-1].text.strip()
        if tr[19] and tr[19].find_all("td")
        else "",
        respondent_advocates=tr[21].find_all("td")[-1].text.strip()
        if tr[21] and tr[21].find_all("td")
        else "",
        final_order=Order(
            hearing_date=tr[-1].find_all("td")[1].text.strip()
            if tr[-1] and tr[-1].find_all("td") and len(tr[-1].find_all("td")) > 1
            else "",
            purpose=tr[-1].find_all("td")[2].text.strip()
            if tr[-1] and tr[-1].find_all("td") and len(tr[-1].find_all("td")) > 2
            else "",
            order_link=tr[-1].find_all("td")[-1].find("a").get("href")
            if tr[-1] and tr[-1].find_all("td") and tr[-1].find_all("td")[-1].find("a")
            else "",
        ),
    )

    return model


if __name__ == "__main__":
    # get_all_cases_by_dfr(51, 2024)
    print(get_case_data("100010000822024"))
