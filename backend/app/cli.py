import click
from .extensions import db
from .models import User
from .routes.auth import EMAIL_RE


def register_cli(app):
    @app.cli.command("create-admin")
    @click.option("--email", prompt=True)
    @click.option("--role", type=click.Choice(["hospital_admin", "security_admin"]),
                  default="hospital_admin", show_default=True)
    @click.password_option()
    def create_admin(email, role, password):
        """Create a hospital or security administrator (cannot be done through public signup)."""
        email = email.strip().lower()
        if not EMAIL_RE.match(email):
            raise click.ClickException("Invalid email")
        if len(password) < 8:
            raise click.ClickException("Password must be at least 8 characters")
        if User.query.filter_by(email=email).first():
            raise click.ClickException("Email already registered")
        user = User(email=email, role=role)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        click.echo(f"Created {role}: {email}")
