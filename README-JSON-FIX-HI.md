# JSON Error Fix

Panel अब JSON parsing को robust तरीके से handle करता है:
- UTF-8 BOM
- ```json code fences
- normal JSON array
- `{ "questions": [...] }`
- accidentally concatenated JSON blocks

Server response अगर JSON के बजाय HTML/text हो तो अब raw response के कारण सहित साफ error दिखेगा, जैसे `Server ने JSON के बजाय response दिया (404)`.

Vercel पर `/api/*` के लिए `api/index.js` इस्तेमाल होता है।
