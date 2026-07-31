# Open questions from code sweep

1. **`POST /login` and `GET /reports`**  
   Implemented in controllers and covered by tests/apiary, but **not** listed in `config/routes.js`, and blueprints (`actions`/`rest`/`shortcuts`) are **false**.  
   → Confirm how production exposes them (missing routes, reverse-proxy rewrite, or dead code).

2. **`LoginController.index`** vs **`connect`**  
   Login (email/password) vs connect (link sicksense account to device uuid).  
   → Confirm which path mobile 4.x+ uses.

3. **Registration dual identity**  
   Device user (`uuid@sicksense.com`) vs sicksense account email.  
   → Document exact client fields (`uuid` vs `email`) for current app versions.

4. **Dashboard**  
   Only `GET /dashboard/now` is routed; controller also has other methods.  
   → Confirm unused methods.

5. **Error envelope**  
   Thai vs English, and whether clients parse `invalidFields`.  
   → Capture golden fixtures from tests.

6. **Side effects**  
   Mailgun, APNs, GCM — which must be real vs stubbed in Python for parity tests.

7. **Cron endpoints**  
   How often called, from where, and whether they should become workers instead of HTTP in Python.

8. **Access token lifetime / refresh**  
   Created on login/register; expiry rules for rewrite.
