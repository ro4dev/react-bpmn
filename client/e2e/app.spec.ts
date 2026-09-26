/**
 * Flujos de la app en un navegador real.
 *
 * Estos tests existen porque las suites de API no alcanzan para el login: la
 * sesión vive entre el access token en memoria, la cookie httpOnly y el refresh
 * con rotación, y el único lugar donde se ve si eso cierra bien es un browser
 * de verdad. Ya pagaron por eso: con el doble montaje de StrictMode, dos
 * `POST /auth/refresh` salían en paralelo con la misma cookie, el segundo
 * recibía 401 (la rotación invalidaba el token del primero) y la app volvía a
 * /login sin mostrar ningún error.
 *
 * Corren contra una API propia (puerto y DB temporales) con los datos del seed.
 */
import { expect, test, type Page } from "@playwright/test";

/** Entra con los botones de acceso rápido de /login. */
async function loginDemo(page: Page, name: "Ana" | "Bruno"): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** El nombre del usuario en el menú del header: prueba que hay sesión. */
function headerUser(page: Page) {
  return page.locator(".rb-user-name");
}

test.describe("sesión", () => {
  test("el acceso rápido de Ana entra al workspace con sus procesos", async ({ page }) => {
    await loginDemo(page, "Ana");

    // El nombre en el header prueba que el usuario se cargó, no solo la URL.
    await expect(headerUser(page)).toHaveText("Ana");

    const tabla = page.locator(".rb-process-list__table");
    await expect(tabla).toBeVisible();
    await expect(tabla.getByText("Pedido de compra")).toBeVisible();
    await expect(tabla.getByText("Aprobación de presupuesto")).toBeVisible();
    // Ana es owner de los dos, así que puede borrarlos.
    await expect(page.getByRole("button", { name: "Eliminar Pedido de compra" })).toBeVisible();
  });

  test("la sesión sobrevive a recargar la página", async ({ page }) => {
    await loginDemo(page, "Ana");

    // La regresión: al recargar se pide un access token con la cookie, y el
    // server rota ese refresh token. Si dos requests de refresh salen juntos, el
    // segundo recibe 401 y la sesión se borra sola.
    await page.reload();
    await expect(page).toHaveURL(/\/$/);
    await expect(headerUser(page)).toHaveText("Ana");
    await expect(page.getByText("Pedido de compra")).toBeVisible();
  });

  test("aguanta varias recargas seguidas", async ({ page }) => {
    await loginDemo(page, "Ana");

    for (let i = 0; i < 3; i++) {
      await page.reload();
      await expect(headerUser(page)).toHaveText("Ana");
    }
    await expect(page.getByText("Pedido de compra")).toBeVisible();
  });

  test("el acceso rápido es un login real, no una puerta trasera", async ({ page }) => {
    // Si el acceso rápido se saltara la auth, una contraseña incorrecta
    // entraría igual. Tiene que fallar como cualquier login.
    await page.goto("/login");
    await page.getByRole("button", { name: /^Ana/ }).click();
    await page.locator("#password").fill("no-es-la-clave");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.locator(".rb-auth-error")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("procesos", () => {
  test("Ana ve el historial con el autor de cada versión", async ({ page }) => {
    await loginDemo(page, "Ana");
    await page.getByRole("button", { name: "Abrir Pedido de compra" }).click();
    await expect(page).toHaveURL(/\/editor/);

    await page.getByRole("button", { name: "Historial" }).click();
    const historial = page.locator(".rb-history");
    await expect(historial).toBeVisible();

    // 3 versiones, y cada una con su autor en la lista.
    await expect(historial.locator(".rb-history__item")).toHaveCount(3);
    const lista = historial.locator(".rb-history__list");
    await expect(lista).toContainText("Ana");
    await expect(lista).toContainText("Bruno");

    // Y el detalle de la versión seleccionada dice "por <autor>".
    await expect(historial.locator(".rb-history__detail-author")).toContainText("por ");
  });

  test("Bruno abre un proceso donde solo puede leer", async ({ page }) => {
    await loginDemo(page, "Bruno");
    await page.getByRole("button", { name: "Abrir Aprobación de presupuesto" }).click();
    await expect(page).toHaveURL(/\/editor/);

    await expect(page.getByText("Tenés acceso de lectura")).toBeVisible();
    await expect(page.locator(".rb-toolbar__role")).toHaveClass(/viewer/);
  });

  test("Bruno edita el proceso del que es editor", async ({ page }) => {
    await loginDemo(page, "Bruno");
    await page.getByRole("button", { name: "Abrir Pedido de compra" }).click();

    await expect(page.locator(".rb-toolbar__role")).toHaveClass(/editor/);
    await expect(page.getByText("Tenés acceso de lectura")).toHaveCount(0);
  });
});
