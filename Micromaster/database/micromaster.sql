-- ============================================================================
--  MICROMASTER B2B PLATFORM — SCRIPT COMPLETO DE BASE DE DATOS
-- ============================================================================
--  Proyecto   : D:\Sprint\Micromaster
--  Backend    : Laravel (PHP)  ·  Frontend: React 18 (Vite)
--  Servidor   : MariaDB 10.4 (XAMPP) · Base: micromaster
--  Host       : localhost:3306        · Usuario: root · Password: (vacía)
--  Origen     : php artisan migrate:fresh --seed + migración 000008
--  Fecha      : 2026-10-02
-- ----------------------------------------------------------------------------
--  IMPORTAR (crea la base y sus tablas):
--      D:\xampp\mysql\bin\mysql.exe -uroot < database\micromaster.sql
--
--  RESTAURAR DESDE CERO CON LAS MIGRACIONES (alternativa):
--      cd backend && php artisan migrate:fresh --seed
-- ----------------------------------------------------------------------------
--
--  ESQUEMA (12 tablas)
--      users                · personal, roles y estado de registro
--      personal_access_tokens · sesiones activas (Sanctum)
--      batches              · lotes FEFO de inventario (11)
--      ingredients          · catálogo de insumos (8)
--      recipes              · recetas de producción (3)
--      recipe_ingredient    · relación receta ↔ insumo
--      orders               · órdenes B2B (6)
--      routes               · rutas logísticas (3)
--      driver_locations     · posiciones GPS de conductores
--      delivery_incidents   · novedades e incidencias de campo
--      company_settings     · perfil B2B de la empresa
--      migrations           · control de migraciones aplicadas
--
-- ----------------------------------------------------------------------------
--  ESTADO DE LA CUENTA (columnas status + is_active)
--      ACTIVE   + is_active=1 → puede iniciar sesión
--      PENDING  + is_active=1 → espera aprobación del Administrador
--      REJECTED + is_active=0 → rechazada, no puede entrar
--
-- ----------------------------------------------------------------------------
--  CUENTAS DE PRUEBA  ·  TODAS EN ESTADO ACTIVE
-- ----------------------------------------------------------------------------
--  Email                    | Contraseña     | Rol                      | Perfil
--  -------------------------|----------------|--------------------------|--------------------
--  admin@micromaster.com    | admin123       | ADMINISTRADOR            | Juan David Tombe
--  logistica@micromaster.com| logistica123   | OPERARIO_LOGISTICO       | Maria Camila Palehor
--  produccion@micromaster.com| produccion123 | SUPERVISOR_PRODUCCION    | Kevin Jesus Millan
--  contabilidad@micromaster.com| contabilidad123 | CONTADOR            | Deiby Anderson Vitonco
--  conductor1@micromaster.com| conductor123  | TRANSPORTISTA            | Andrés Rivas Castañeda
--  conductor2@micromaster.com| conductor123  | TRANSPORTISTA            | Laura Sofía Marín
--  conductor3@micromaster.com| conductor123  | TRANSPORTISTA            | Camilo Andrés Ospino
--
-- ----------------------------------------------------------------------------
--  MATRIZ DE ROLES (app/Models/User.php → user_permissions())
-- ----------------------------------------------------------------------------
--  Rol                   | Módulos con escritura     | Sólo lectura      | Permisos
--  ----------------------|---------------------------|-------------------|---------------------
--  ADMINISTRADOR         | todos                     | —                 | C R U D + download
--  OPERARIO_LOGISTICO    | inventory_stock,          | —                 | C R U D
--  |                      | orders_delivery           |                   |
--  SUPERVISOR_PRODUCCION | recipes_production        | inventory_stock   | C R U D
--  CONTADOR              | —                         | reports_simulations | R, download
--  TRANSPORTISTA         | orders_delivery           | —                 | C R U
--      C=create  R=read  U=update  D=delete
--
--  Rutas protegidas por RoleMiddleware / ModulePermissionMiddleware:
--      /api/*               → exige token Bearer (auth:sanctum)
--      /api/admin/*         → sólo ADMINISTRADOR
--      /api/reports/*       → módulo reports_simulations (admin + contador)
--      /api/stock/*         → admin + operario (escritura), supervisor (lectura)
--
-- ============================================================================
-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: micromaster
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `micromaster`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `micromaster` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `micromaster`;

--
-- Table structure for table `batches`
--

DROP TABLE IF EXISTS `batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `batches` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ingredient_id` bigint(20) unsigned NOT NULL,
  `batch_code` varchar(191) NOT NULL,
  `supplier_name` varchar(191) DEFAULT NULL,
  `qr_code_hash` varchar(191) DEFAULT NULL,
  `quantity` decimal(10,4) NOT NULL,
  `initial_quantity` decimal(10,4) DEFAULT NULL,
  `expiration_date` date NOT NULL,
  `status` enum('optimal','warning','critical') NOT NULL DEFAULT 'optimal',
  `received_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `batches_qr_code_hash_unique` (`qr_code_hash`),
  KEY `batches_ingredient_id_foreign` (`ingredient_id`),
  CONSTRAINT `batches_ingredient_id_foreign` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `batches`
--

LOCK TABLES `batches` WRITE;
/*!40000 ALTER TABLE `batches` DISABLE KEYS */;
INSERT INTO `batches` VALUES (1,1,'BCH-ARR-20250101','Arroz del Valle S.A.','QR-ARR-0001-A7F3',500.0000,500.0000,'2026-11-16','optimal','2026-09-22 11:22:49','2026-10-02 16:22:49','2026-10-02 16:22:49'),(2,1,'BCH-ARR-20241215','Arroz del Valle S.A.','QR-ARR-0002-B92C',200.0000,200.0000,'2026-10-07','warning','2026-08-03 11:22:49','2026-10-02 16:22:49','2026-10-02 16:22:49'),(3,1,'BCH-ARR-20241101','Granos Unidos Ltda.','QR-ARR-0003-C41D',50.0000,50.0000,'2026-10-04','critical','2026-07-04 11:22:49','2026-10-02 16:22:49','2026-10-02 16:22:49'),(4,2,'BCH-FRJ-20250110','Distribuidora Legumbres','QR-FRJ-0001-E88A',300.0000,300.0000,'2026-12-01','optimal','2026-09-27 11:22:49','2026-10-02 16:22:49','2026-10-02 16:22:49'),(5,2,'BCH-FRJ-20241220','Distribuidora Legumbres','QR-FRJ-0002-F07B',150.0000,150.0000,'2026-10-10','warning','2026-08-23 11:22:49','2026-10-02 16:22:49','2026-10-02 16:22:49'),(6,3,'BCH-ACE-20250105','Aceites del Caribe','QR-ACE-0001-G55E',200.0000,200.0000,'2026-11-01','optimal','2026-09-17 11:22:49','2026-10-02 16:22:49','2026-10-02 16:22:49'),(7,8,'BCH-POL-20250112','Pollos Santa Mar├¡a','QR-POL-0001-H13F',100.0000,100.0000,'2026-10-05','warning','2026-09-30 11:22:49','2026-10-02 16:22:49','2026-10-02 16:22:49'),(8,8,'BCH-POL-20241228','Pollos Santa Mar├¡a','QR-POL-0002-J90G',30.0000,30.0000,'2026-10-03','critical','2026-08-18 11:22:49','2026-10-02 16:22:49','2026-10-02 16:22:49'),(9,7,'BCH-CEB-20250108','Cebollas del Norte','QR-CEB-0001-K26H',400.0000,400.0000,'2026-10-22','optimal','2026-09-25 11:22:49','2026-10-02 16:22:49','2026-10-02 16:22:49'),(10,4,'BCH-SAL-20250115','Salinas del Magdalena','QR-SAL-0001-M37J',25.0000,25.0000,'2027-11-06','optimal','2026-09-20 11:22:49','2026-10-02 16:22:49','2026-10-02 16:22:49'),(11,5,'BCH-SOY-20250116','Salsas Oriental S.A.','QR-SOY-0001-N48K',5.0000,5.0000,'2027-03-31','optimal','2026-09-24 11:22:49','2026-10-02 16:22:49','2026-10-02 16:22:49');
/*!40000 ALTER TABLE `batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `company_settings`
--

DROP TABLE IF EXISTS `company_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `company_settings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `company_name` varchar(191) NOT NULL DEFAULT 'MICROMASTER B2B',
  `tax_id` varchar(191) DEFAULT NULL,
  `warehouse_address` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `version` varchar(191) NOT NULL DEFAULT '2.4.1',
  `environment` varchar(191) NOT NULL DEFAULT 'Produccion',
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `company_settings`
--

LOCK TABLES `company_settings` WRITE;
/*!40000 ALTER TABLE `company_settings` DISABLE KEYS */;
INSERT INTO `company_settings` VALUES (1,'MICROMASTER B2B','901.456.789-1','Cra. 45 # 12-40, Bodega Central, Medellin','+57 604 123 4567','contacto@micromaster.com','2.4.1','Produccion',6.2442000,-75.5812000,NULL,NULL);
/*!40000 ALTER TABLE `company_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delivery_incidents`
--

DROP TABLE IF EXISTS `delivery_incidents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `delivery_incidents` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `route_id` bigint(20) unsigned NOT NULL,
  `driver_id` bigint(20) unsigned NOT NULL,
  `type` enum('CLIENT_NOT_FOUND','VEHICLE_BREAKDOWN','WRONG_ADDRESS','OTHER') NOT NULL DEFAULT 'OTHER',
  `description` text DEFAULT NULL,
  `status` enum('OPEN','RESOLVED') NOT NULL DEFAULT 'OPEN',
  `resolution` varchar(191) DEFAULT NULL,
  `reported_at` datetime NOT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `delivery_incidents_order_id_foreign` (`order_id`),
  KEY `delivery_incidents_driver_id_foreign` (`driver_id`),
  KEY `delivery_incidents_status_index` (`status`),
  KEY `delivery_incidents_route_id_index` (`route_id`),
  CONSTRAINT `delivery_incidents_driver_id_foreign` FOREIGN KEY (`driver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `delivery_incidents_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `delivery_incidents_route_id_foreign` FOREIGN KEY (`route_id`) REFERENCES `routes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_incidents`
--

LOCK TABLES `delivery_incidents` WRITE;
/*!40000 ALTER TABLE `delivery_incidents` DISABLE KEYS */;
INSERT INTO `delivery_incidents` VALUES (1,1,1,5,'WRONG_ADDRESS','El cliente report├│ una direcci├│n incorrecta: confirmar acceso por la puerta 3 del dep├│sito.','OPEN',NULL,'2026-10-02 09:22:49',NULL,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(2,3,2,6,'VEHICLE_BREAKDOWN','Pinchazo en la llanta trasera sobre la v├¡a al puerto. Se solicita gr├║a.','OPEN',NULL,'2026-10-02 10:22:49',NULL,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(3,2,1,5,'CLIENT_NOT_FOUND','No hab├¡a nadie en el punto de entrega a la hora programada.','RESOLVED','Se contact├│ al cliente y la entrega se reprogram├│ para la siguiente salida.','2026-10-01 11:22:49','2026-10-02 05:22:49','2026-10-02 16:22:49','2026-10-02 16:22:49');
/*!40000 ALTER TABLE `delivery_incidents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `driver_locations`
--

DROP TABLE IF EXISTS `driver_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `driver_locations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `driver_id` bigint(20) unsigned NOT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `speed_kmh` decimal(6,2) DEFAULT NULL,
  `heading` decimal(6,2) DEFAULT NULL,
  `recorded_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `driver_locations_driver_id_unique` (`driver_id`),
  CONSTRAINT `driver_locations_driver_id_foreign` FOREIGN KEY (`driver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `driver_locations`
--

LOCK TABLES `driver_locations` WRITE;
/*!40000 ALTER TABLE `driver_locations` DISABLE KEYS */;
INSERT INTO `driver_locations` VALUES (1,5,8.61050000,-75.19000000,62.40,18.00,'2026-10-02 11:18:49','2026-10-02 16:22:49','2026-10-02 16:22:49'),(2,6,6.24420000,-75.58120000,0.00,0.00,'2026-10-02 11:22:37','2026-10-02 16:22:49','2026-10-02 16:22:49'),(3,7,6.20880000,-75.56600000,0.00,0.00,'2026-10-02 10:47:49','2026-10-02 16:22:49','2026-10-02 16:22:49');
/*!40000 ALTER TABLE `driver_locations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ingredients`
--

DROP TABLE IF EXISTS `ingredients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ingredients` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) NOT NULL,
  `unit` varchar(191) NOT NULL,
  `cost_per_unit` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ingredients`
--

LOCK TABLES `ingredients` WRITE;
/*!40000 ALTER TABLE `ingredients` DISABLE KEYS */;
INSERT INTO `ingredients` VALUES (1,'Arroz Graneado','kg',2.50,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(2,'Fr├¡joles Rojos','kg',3.20,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(3,'Aceite Vegetal','litro',4.80,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(4,'Sal Marina','kg',1.20,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(5,'Soya Sauce','litro',6.50,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(6,'Pimienta Negra','kg',8.90,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(7,'Cebolla Junca','kg',1.80,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(8,'Pollo Fresco','kg',9.50,'2026-10-02 16:22:49','2026-10-02 16:22:49');
/*!40000 ALTER TABLE `ingredients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(191) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'2019_12_14_000001_create_personal_access_tokens_table',1),(2,'2024_01_01_000000_create_micromaster_tables',1),(3,'2024_01_01_000001_add_order_management_fields',1),(4,'2024_01_01_000002_add_traceability_to_batches',1),(5,'2024_01_01_000003_add_transportista_role_and_user_profile',1),(6,'2024_01_01_000004_add_logistics_coordinates',1),(7,'2024_01_01_000005_create_driver_locations_and_incidents',1),(8,'2024_01_01_000006_add_administration_module',1),(9,'2024_01_01_000007_add_profile_fields_to_users',1),(10,'2024_01_01_000008_add_registration_approval_to_users',2);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `route_id` bigint(20) unsigned DEFAULT NULL,
  `driver_id` bigint(20) unsigned DEFAULT NULL,
  `destination` varchar(191) NOT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `client_name` varchar(191) DEFAULT NULL,
  `status` enum('pending','assigned','in_transit','delivered','cancelled') NOT NULL DEFAULT 'pending',
  `payment_method` enum('cash','qr') NOT NULL DEFAULT 'cash',
  `payment_status` enum('pending','confirmed','completed','refunded') NOT NULL DEFAULT 'pending',
  `otp_code` varchar(191) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `received_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `change_due` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `orders_route_id_foreign` (`route_id`),
  KEY `orders_driver_id_foreign` (`driver_id`),
  CONSTRAINT `orders_driver_id_foreign` FOREIGN KEY (`driver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `orders_route_id_foreign` FOREIGN KEY (`route_id`) REFERENCES `routes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (1,1,5,'Bodega Central - Barranquilla',10.96850000,-74.78130000,'Distribuidora El ├ëxito','in_transit','cash','confirmed','8421',1250.00,1500.00,250.00,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(2,1,5,'Bodega Central - Barranquilla',11.00800000,-74.83000000,'Mercados La Gran V├¡a','delivered','qr','completed','3679',890.00,890.00,0.00,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(3,2,6,'Mercado Norte - Cartagena',10.39100000,-75.51440000,'Supermercado Buen D├¡a','assigned','cash','pending','5103',2100.00,0.00,0.00,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(4,NULL,NULL,'Plaza de Mercado Sur - Bogot├í',4.71100000,-74.07210000,'Almacenes ├ëxito S.A.','pending','qr','pending','7264',3450.00,0.00,0.00,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(5,NULL,NULL,'Centro de Abastos - Cali',3.45160000,-76.53200000,'Distribuciones Andina','cancelled','cash','refunded','1902',780.00,0.00,0.00,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(6,3,7,'Distribuidora Sur - Medell├¡n',6.20880000,-75.56600000,'Tiendas El Vecino','delivered','cash','completed','4458',1675.00,2000.00,325.00,'2026-10-02 16:22:49','2026-10-02 16:22:49');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(191) NOT NULL,
  `tokenable_id` bigint(20) unsigned NOT NULL,
  `name` varchar(191) NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
INSERT INTO `personal_access_tokens` VALUES (12,'App\\Models\\User',1,'Chrome ┬À Windows (Navegador Web)','9dc279847a8c01e952be1f56e4bbcba1992d905f7ee4477594fb821f22a43247','[\"*\"]','2026-10-05 14:23:37',NULL,'2026-10-05 14:21:27','2026-10-05 14:23:37'),(13,'App\\Models\\User',1,'Chrome ┬À Windows (Navegador Web)','153947ab29a88c2f108ddf345ab07dbbee9650d67e90b1f048d5218be06c8a26','[\"*\"]','2026-10-05 14:26:39',NULL,'2026-10-05 14:26:20','2026-10-05 14:26:39');
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recipe_ingredient`
--

DROP TABLE IF EXISTS `recipe_ingredient`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `recipe_ingredient` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `recipe_id` bigint(20) unsigned NOT NULL,
  `ingredient_id` bigint(20) unsigned NOT NULL,
  `quantity` decimal(10,4) NOT NULL,
  `unit_cost` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `recipe_ingredient_recipe_id_foreign` (`recipe_id`),
  KEY `recipe_ingredient_ingredient_id_foreign` (`ingredient_id`),
  CONSTRAINT `recipe_ingredient_ingredient_id_foreign` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `recipe_ingredient_recipe_id_foreign` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recipe_ingredient`
--

LOCK TABLES `recipe_ingredient` WRITE;
/*!40000 ALTER TABLE `recipe_ingredient` DISABLE KEYS */;
INSERT INTO `recipe_ingredient` VALUES (1,1,1,1.0000,2.50,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(2,1,2,0.5000,3.20,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(3,1,4,0.0500,1.20,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(4,2,8,1.0000,9.50,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(5,2,5,0.3000,6.50,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(6,2,3,0.1000,4.80,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(7,2,6,0.0200,8.90,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(8,3,7,0.8000,1.80,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(9,3,3,0.0500,4.80,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(10,3,4,0.0300,1.20,'2026-10-02 16:22:49','2026-10-02 16:22:49');
/*!40000 ALTER TABLE `recipe_ingredient` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recipes`
--

DROP TABLE IF EXISTS `recipes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `recipes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) NOT NULL,
  `waste_percentage` decimal(5,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recipes`
--

LOCK TABLES `recipes` WRITE;
/*!40000 ALTER TABLE `recipes` DISABLE KEYS */;
INSERT INTO `recipes` VALUES (1,'Base Arroz con Fr├¡joles',5.00,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(2,'Pollo con Soya',8.00,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(3,'Sopa de Cebolla',3.00,'2026-10-02 16:22:49','2026-10-02 16:22:49');
/*!40000 ALTER TABLE `recipes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `routes`
--

DROP TABLE IF EXISTS `routes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `routes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `driver_id` bigint(20) unsigned NOT NULL,
  `destination` varchar(191) NOT NULL,
  `origin_label` varchar(191) DEFAULT NULL,
  `origin_lat` decimal(10,8) DEFAULT NULL,
  `origin_lng` decimal(11,8) DEFAULT NULL,
  `route_code` varchar(191) NOT NULL,
  `status` enum('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
  `scheduled_date` date NOT NULL,
  `distance_km` decimal(10,2) DEFAULT NULL,
  `duration_min` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `routes_driver_id_foreign` (`driver_id`),
  CONSTRAINT `routes_driver_id_foreign` FOREIGN KEY (`driver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `routes`
--

LOCK TABLES `routes` WRITE;
/*!40000 ALTER TABLE `routes` DISABLE KEYS */;
INSERT INTO `routes` VALUES (1,5,'Bodega Central - Barranquilla','Planta Principal - Medell├¡n',6.24420000,-75.58120000,'RTE-001','in_progress','2026-10-03',728.35,794.60,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(2,6,'Mercado Norte - Cartagena','Planta Principal - Medell├¡n',6.24420000,-75.58120000,'RTE-002','pending','2026-10-04',622.57,679.20,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(3,7,'Distribuidora Sur - Medell├¡n','Planta Principal - Medell├¡n',6.24420000,-75.58120000,'RTE-003','completed','2026-10-01',5.78,6.30,'2026-10-02 16:22:49','2026-10-02 16:22:49');
/*!40000 ALTER TABLE `routes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) NOT NULL,
  `identity_document` varchar(191) DEFAULT NULL,
  `employee_code` varchar(191) DEFAULT NULL,
  `warehouse_site` varchar(191) DEFAULT NULL,
  `shift_schedule` varchar(191) DEFAULT NULL,
  `supervisor_name` varchar(191) DEFAULT NULL,
  `two_factor_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `two_factor_method` varchar(191) DEFAULT NULL,
  `locale` varchar(5) NOT NULL DEFAULT 'es',
  `theme` varchar(10) NOT NULL DEFAULT 'light',
  `notify_email` tinyint(1) NOT NULL DEFAULT 1,
  `notify_push` tinyint(1) NOT NULL DEFAULT 1,
  `notify_sound` tinyint(1) NOT NULL DEFAULT 1,
  `email` varchar(191) NOT NULL,
  `password` varchar(191) NOT NULL,
  `role` enum('ADMINISTRADOR','OPERARIO_LOGISTICO','SUPERVISOR_PRODUCCION','CONTADOR','TRANSPORTISTA') NOT NULL DEFAULT 'ADMINISTRADOR',
  `status` enum('PENDING','ACTIVE','REJECTED') NOT NULL DEFAULT 'ACTIVE',
  `requested_role` varchar(40) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `approved_by` bigint(20) unsigned DEFAULT NULL,
  `rejection_reason` varchar(200) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `vehicle` varchar(191) DEFAULT NULL,
  `photo_url` varchar(191) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `users_employee_code_unique` (`employee_code`),
  KEY `users_status_index` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Juan David Tombe',NULL,NULL,NULL,NULL,NULL,0,NULL,'es','light',1,1,1,'admin@micromaster.com','$2y$12$RfZnIZ0EmWqDEn4j86DptOkPe2cLxEURWMfvaGRciKVSHoMQOCXiG','ADMINISTRADOR','ACTIVE',NULL,NULL,NULL,NULL,NULL,NULL,'photos/1/gGwwkjMan0bImk6om5Zrvdxx5KqSYu2y07t64T3D.jpg',1,'2026-10-05 14:26:20',NULL,'2026-10-02 16:22:48','2026-10-05 14:26:20'),(2,'Maria Camila Palehor',NULL,NULL,NULL,NULL,NULL,0,NULL,'es','light',1,1,1,'logistica@micromaster.com','$2y$12$pzyajcWV3NV9OYgza.RXIeKTjNRPNK7c71VvjrrsME5gAUX13EH4W','OPERARIO_LOGISTICO','ACTIVE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-10-02 16:48:16',NULL,'2026-10-02 16:22:48','2026-10-02 16:48:16'),(3,'Kevin Jesus Millan',NULL,NULL,NULL,NULL,NULL,0,NULL,'es','light',1,1,1,'produccion@micromaster.com','$2y$12$iJWwKBWAS/lyctk1Rbf1beoBuvg0jGhu9cuaw/xZSXN2uqMJ5xD0i','SUPERVISOR_PRODUCCION','ACTIVE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(4,'Deiby Anderson Vitonco',NULL,NULL,NULL,NULL,NULL,0,NULL,'es','light',1,1,1,'contabilidad@micromaster.com','$2y$12$nM8CGMJSPzLwJk4PIAw60OsLPcCoseQQHXm/o/zTSQ.AK23wugP5G','CONTADOR','ACTIVE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(5,'Andr├®s Rivas Casta├▒eda',NULL,NULL,NULL,NULL,NULL,0,NULL,'es','light',1,1,1,'conductor1@micromaster.com','$2y$12$6EyyOMeVZkL49eeJuo6S2OR2VjQa5MIMRQbwKxJhxpuS9zCMEmvle','TRANSPORTISTA','ACTIVE',NULL,NULL,NULL,NULL,'+57 310 445 8890','Cami├│n Chevrolet NPR ┬À JKP 482','https://randomuser.me/api/portraits/men/32.jpg',1,NULL,NULL,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(6,'Laura Sof├¡a Mar├¡n',NULL,NULL,NULL,NULL,NULL,0,NULL,'es','light',1,1,1,'conductor2@micromaster.com','$2y$12$pTrMm2zg3.wEwayjqGKeBuiHRLI4epav0H8qbtbTZIPpULIbfBYCm','TRANSPORTISTA','ACTIVE',NULL,NULL,NULL,NULL,'+57 315 209 7741','Cami├│n Isuzu NPR ┬À MTR 917','https://randomuser.me/api/portraits/women/44.jpg',1,NULL,NULL,'2026-10-02 16:22:49','2026-10-02 16:22:49'),(7,'Camilo Andr├®s Ospino',NULL,NULL,NULL,NULL,NULL,0,NULL,'es','light',1,1,1,'conductor3@micromaster.com','$2y$12$GBmlcx6NQGNfTgndheAZKehmCAnjFm323/PV/m3Ei04Fe4y46aptS','TRANSPORTISTA','ACTIVE',NULL,NULL,NULL,NULL,'+57 301 663 2058','Cami├│n Hyundai HD78 ┬À TDS 305','https://randomuser.me/api/portraits/men/76.jpg',1,NULL,NULL,'2026-10-02 16:22:49','2026-10-02 16:22:49');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'micromaster'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-06  8:15:28
