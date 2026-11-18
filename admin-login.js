import { supabase, SUPABASE_CONFIGURED } from './supabase-client.js';

const form = document.getElementById('adminLoginForm');
const message = document.getElementById('authMessage');
const button = document.getElementById('adminLoginButton');
function showMessage(text, type='error') { message.textContent=text; message.className=`auth-message ${type}`; }
if (!SUPABASE_CONFIGURED || !supabase) {
  showMessage('Supabase is not configured. Check assets/js/supabase-config.js and redeploy.', 'info');
}
form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!SUPABASE_CONFIGURED || !supabase) { showMessage('Complete the Supabase connection before signing in.', 'info'); return; }
  const email=document.getElementById('adminEmail').value.trim().toLowerCase();
  const password=document.getElementById('adminPassword').value;
  button.disabled=true;button.querySelector('span').textContent='Verifying access…';message.className='auth-message';
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error||!data?.user){await supabase.auth.signOut();showMessage('Sign-in failed. Check your email and password, and confirm that the Supabase Auth user exists.');resetButton();return;}
  const {data:allowed,error:permissionError}=await supabase.rpc('is_onlyus_admin');
  if(permissionError||!allowed){await supabase.auth.signOut();showMessage('This account is not authorised. Ask the ONLYUSLABS owner to add the email to Administrators, and confirm the database setup has been run.');resetButton();return;}
  window.location.replace('/admin/');
});
function resetButton(){button.disabled=false;button.querySelector('span').textContent='Sign in securely';}
