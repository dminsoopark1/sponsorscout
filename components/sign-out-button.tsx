export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button className="textbtn" type="submit">Log out</button>
    </form>
  );
}
