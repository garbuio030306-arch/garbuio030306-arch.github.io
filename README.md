# giovi365 · Research Portfolio

Live at **https://garbuio030306-arch.github.io**

## How to add a project or a link

Everything on the portfolio page comes from one file: [`projects.json`](projects.json).
You can edit it right here on github.com. You don't need any software.

1. Open [`projects.json`](projects.json) and click the **pencil icon** (Edit) at the top right.
2. To **add a project**, copy one whole project block (from `{` to `}`), paste it after
   the last one, and put a **comma** between the two blocks. Then change the text:

   ```json
   {
     "title": "My New Project",
     "category": "Equity research",
     "year": "2026",
     "description": "One or two sentences on what it is.",
     "points": ["A key result", "Another key result"],
     "tags": ["Excel", "DCF"],
     "link": "https://link-to-the-project.com",
     "button": "Open the project"
   }
   ```

   - `link` can be any web address (a Google Drive file, a PDF, a LinkedIn post, another site).
   - Leave out `points`, `tags` or `link` if you don't need them.
3. To **add a personal link** (LinkedIn, email, CV), add an entry to `"links"`:

   ```json
   "links": [
     { "label": "GitHub", "url": "https://github.com/garbuio030306-arch" },
     { "label": "LinkedIn", "url": "https://www.linkedin.com/in/your-name" }
   ]
   ```
4. Click **Commit changes**. The site updates in about a minute.

**Rules that keep it working:** every text goes in "double quotes", items in a list are
separated by commas, and there is **no comma after the last item**. If the page says
"Projects could not load", there's a typo in `projects.json`. Open the file's history and
compare it with the previous version.

## To host a project's files here

Upload the files into a new folder (for example `my-project/`) with **Add file → Upload files**,
then set the project's `link` to `"my-project/"` (or `"my-project/report.pdf"`).

## What's in this repo

- `index.html`: the portfolio page (reads `projects.json`)
- `treasury/`: US Treasury Yield Curve Forecaster (a snapshot of the Streamlit app; the
  lever scenarios are computed in the browser from the fitted model coefficients)
- `real-estate-map/`: Real Estate Rate-Sensitivity Map
