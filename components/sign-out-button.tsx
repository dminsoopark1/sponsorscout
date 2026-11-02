export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button className="textbtn" type="submit">Sign out</button>
    </form>
  );
}
