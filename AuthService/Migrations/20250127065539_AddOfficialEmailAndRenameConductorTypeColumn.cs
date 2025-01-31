using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuthService.Migrations
{
    /// <inheritdoc />
    public partial class AddOfficialEmailAndRenameConductorTypeColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "ConductorType",
                table: "Conductors",
                newName: "conductor_type");

            migrationBuilder.RenameColumn(
                name: "ContactEmail",
                table: "Conductors",
                newName: "OfficialEmail");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "conductor_type",
                table: "Conductors",
                newName: "ConductorType");

            migrationBuilder.RenameColumn(
                name: "OfficialEmail",
                table: "Conductors",
                newName: "ContactEmail");
        }
    }
}
