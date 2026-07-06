const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Error: DATABASE_URL environment variable is missing in .env file.');
  console.error('Please configure DATABASE_URL in your .env file:');
  console.error('DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres');
  process.exit(1);
}

const client = new Client({ connectionString });

const ddlScripts = [
  '01-create-user-profiles.sql',
  '10-create-taxpayer-listings-table.sql',
  '11-create-sales-table.sql',
  '12-add-soft-delete-to-sales.sql',
  '13-update-user-profiles-schema.sql',
  '14-fix-sales-user-relationship.sql',
  '15-add-total-actual-amount-column.sql',
  '16-add-taxpayer-listing-id-to-sales.sql',
  '17-add-accounting-pot-column.sql',
  '18-create-notifications-table.sql',
  '19-create-purchases-categories-table.sql',
  '20-patch-sales-missing-columns.sql',
  '21-create-log-notification-function.sql',
  '22-drop-duplicate-sales-fkey.sql'
];

const dataScripts = [
  'user_profiles_rows.sql',
  'taxpayer_listings_rows.sql',
  'sales_rows.sql',
  'notifications_rows.sql',
  'purchases_categories_rows.sql',
  'purchases_rows.sql',
  'invoices_rows.sql',
  'commission_report_rows.sql',
  'commission_agent_breakdown_rows.sql',
  'user_activity_logs_rows.sql',
  'user_login_history_rows.sql'
];

async function run() {
  try {
    console.log('Connecting to Supabase Database...');
    await client.connect();
    console.log('Connected successfully!');

    // 0. Clean Drop all existing tables to allow a clean fresh restore
    console.log('\n--- Cleaning up existing tables ---');
    const cleanDropDDL = `
      DROP TABLE IF EXISTS public.commission_agent_breakdown CASCADE;
      DROP TABLE IF EXISTS public.commission_report CASCADE;
      DROP TABLE IF EXISTS public.purchases CASCADE;
      DROP TABLE IF EXISTS public.sales CASCADE;
      DROP TABLE IF EXISTS public.taxpayer_listings CASCADE;
      DROP TABLE IF EXISTS public.user_profiles CASCADE;
      DROP TABLE IF EXISTS public.purchases_categories CASCADE;
      DROP TABLE IF EXISTS public.notifications CASCADE;
      DROP TABLE IF EXISTS public.invoices CASCADE;
      DROP TABLE IF EXISTS public.user_activity_logs CASCADE;
      DROP TABLE IF EXISTS public.user_login_history CASCADE;
      
      -- Drop custom types if they exist
      DROP TYPE IF EXISTS public.user_role CASCADE;
      DROP TYPE IF EXISTS public.user_status CASCADE;
    `;
    await client.query(cleanDropDDL);
    console.log('Existing tables dropped.');

    // 1. Create Base Reconstructed Tables first (no FK dependencies)
    console.log('\n--- Creating Base Reconstructed Tables ---');
    const baseReconstructedDDL = `
      -- public.commission_report
      CREATE TABLE IF NOT EXISTS public.commission_report (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        report_number bigint,
        sales_uuids uuid[],
        created_by uuid,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        deleted_at timestamptz,
        remarks text,
        status varchar(50),
        history jsonb,
        secretary_pot jsonb,
        accounting_pot jsonb
      );

      -- public.invoices
      CREATE TABLE IF NOT EXISTS public.invoices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz DEFAULT now(),
        invoice_number varchar(100),
        invoice_date date,
        payment_terms varchar(100),
        due_date date,
        po_number varchar(100),
        company_name varchar(255),
        trade_license varchar(100),
        tdn varchar(100),
        company_address text,
        company_email varchar(255),
        company_phone varchar(50),
        client_name varchar(255),
        ship_to text,
        items jsonb,
        tax_rate numeric(5,2),
        show_tax boolean,
        discount_amount numeric(12,2),
        show_discount boolean,
        shipping_amount numeric(12,2),
        show_shipping boolean,
        subtotal numeric(12,2),
        total numeric(12,2),
        amount_paid numeric(12,2),
        balance_due numeric(12,2),
        noted_by varchar(255),
        terms text,
        currency varchar(20)
      );

      -- public.user_activity_logs
      CREATE TABLE IF NOT EXISTS public.user_activity_logs (
        id serial PRIMARY KEY,
        user_id uuid,
        member_id bigint,
        role_id integer,
        user_type varchar(50),
        full_name varchar(255),
        email varchar(255),
        activity_type varchar(100),
        activity_module varchar(100),
        activity_description text,
        entity_type varchar(100),
        entity_id uuid,
        request_method varchar(10),
        request_path text,
        ip_address varchar(50),
        user_agent text,
        metadata jsonb,
        created_at timestamptz DEFAULT now()
      );

      -- public.user_login_history
      CREATE TABLE IF NOT EXISTS public.user_login_history (
        id serial PRIMARY KEY,
        user_id uuid,
        member_id bigint,
        role_id integer,
        user_type varchar(50),
        full_name varchar(255),
        email varchar(255),
        session_id uuid,
        login_status varchar(50),
        failure_reason text,
        ip_address varchar(50),
        user_agent text,
        device_info jsonb,
        logged_in_at timestamptz,
        logged_out_at timestamptz,
        created_at timestamptz DEFAULT now()
      );
    `;
    await client.query(baseReconstructedDDL);
    console.log('Base reconstructed tables created.');

    // 2. Run DDL scripts from scripts/
    console.log('\n--- Running DDL Scripts ---');
    for (const script of ddlScripts) {
      console.log(`Running ${script}...`);
      const filePath = path.join(__dirname, script);
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
    }

    // 3. Create Dependent Reconstructed Tables (relying on taxpayer_listings, purchases_categories, and sales)
    console.log('\n--- Creating Dependent Reconstructed Tables ---');
    const dependentReconstructedDDL = `
      -- public.purchases
      CREATE TABLE IF NOT EXISTS public.purchases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tax_month date NOT NULL,
        tin_id uuid REFERENCES public.taxpayer_listings(id) ON DELETE SET NULL,
        tin varchar(20),
        name varchar(255),
        substreet_street_brgy text,
        district_city_zip text,
        gross_taxable numeric(12,2),
        invoice_number varchar(100),
        tax_type varchar(20),
        official_receipt text[],
        date_added date DEFAULT CURRENT_DATE,
        user_uuid uuid,
        user_full_name varchar(150),
        remarks text,
        is_deleted boolean DEFAULT false,
        deleted_at timestamptz,
        updated_at timestamptz DEFAULT now(),
        created_at timestamptz DEFAULT now(),
        total_actual_amount numeric(12,2),
        category_id uuid REFERENCES public.purchases_categories(id) ON DELETE SET NULL
      );

      -- public.commission_agent_breakdown
      CREATE TABLE IF NOT EXISTS public.commission_agent_breakdown (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        commission_report_uuid uuid REFERENCES public.commission_report(uuid) ON DELETE CASCADE,
        commission_report_number bigint,
        agent_uuid uuid,
        agent_name text,
        developer text,
        client text,
        reservation_date date,
        comm numeric(12,2),
        comm_type text,
        bdo_account text,
        net_of_vat numeric(12,2),
        status text,
        calculation_type text,
        agents_rate numeric(5,2),
        developers_rate numeric(5,2),
        agent_amount numeric(12,2),
        agent_vat numeric(12,2),
        agent_ewt numeric(12,2),
        agent_ewt_rate numeric(5,2),
        agent_net_comm numeric(12,2),
        um_name text,
        um_calculation_type text,
        um_rate numeric(5,2),
        um_developers_rate numeric(5,2),
        um_amount numeric(12,2),
        um_vat numeric(12,2),
        um_ewt numeric(12,2),
        um_ewt_rate numeric(5,2),
        um_net_comm numeric(12,2),
        tl_name text,
        tl_calculation_type text,
        tl_rate numeric(5,2),
        tl_developers_rate numeric(5,2),
        tl_amount numeric(12,2),
        tl_vat numeric(12,2),
        tl_ewt numeric(12,2),
        tl_ewt_rate numeric(5,2),
        tl_net_comm numeric(12,2),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        deleted_at timestamptz,
        lrsalesid text,
        memberid text,
        um_bdo_account text,
        tl_bdo_account text,
        secretary_remarks text,
        accounting_remarks text,
        sales_uuid uuid REFERENCES public.sales(id) ON DELETE SET NULL,
        invoice_number text
      );
    `;
    await client.query(dependentReconstructedDDL);
    console.log('Dependent reconstructed tables created.');

    // 4. Drop foreign keys and constraints to prevent violations with existing duplicate/auth records
    console.log('\n--- Decoupling auth.users foreign keys and unique constraints ---');
    const dropAuthFks = `
      ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_auth_user_id_fkey CASCADE;
      ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_user_uuid_fkey CASCADE;
      ALTER TABLE public.purchases_categories DROP CONSTRAINT IF EXISTS purchases_categories_user_uuid_fkey CASCADE;
      
      -- Drop the taxpayer_listings unique constraint to allow duplicate TIN imports from the backup
      ALTER TABLE public.taxpayer_listings DROP CONSTRAINT IF EXISTS taxpayer_listings_tin_type_key CASCADE;
    `;
    await client.query(dropAuthFks);
    console.log('Decoupled auth.users and dropped unique constraints successfully.');

    // 5. Disable constraints temporarily during restoration
    console.log('\n--- Entering replica mode (disabling triggers/constraints) ---');
    await client.query("SET session_replication_role = 'replica';");

    // 6. Restore data from lrsync_db/
    console.log('\n--- Restoring Data ---');
    const convertJsonArraysToPg = (sql) => {
      // Replace '[]' with '{}'
      sql = sql.replace(/'\[\]'/g, "'{}'");
      // Replace '["value1", "value2"]' with '{"value1", "value2"}'
      return sql.replace(/'\[(.*?)\]'/g, (match, content) => {
        try {
          const parsed = JSON.parse(`[${content}]`);
          if (Array.isArray(parsed)) {
            const pgArray = parsed.map(item => `"${item.replace(/"/g, '\\"')}"`).join(',');
            return `'{${pgArray}}'`;
          }
        } catch (e) {
          // Fall back to original match if not parseable
        }
        return match;
      });
    };

    for (const file of dataScripts) {
      console.log(`Restoring ${file}...`);
      const filePath = path.join(__dirname, 'lrsync_db', file);
      if (fs.existsSync(filePath)) {
        let sql = fs.readFileSync(filePath, 'utf8');
        if (file === 'sales_rows.sql' || file === 'purchases_rows.sql') {
          sql = sql.replace(/ARRAY\[\]/g, 'ARRAY[]::text[]');
          sql = convertJsonArraysToPg(sql);
        }
        if (file === 'commission_report_rows.sql') {
          // Cast ARRAY[...] to uuid[] to avoid PG type mismatch
          sql = sql.replace(/(ARRAY\[[^\]]*\])/g, '$1::uuid[]');
        }
        if (file === 'notifications_rows.sql') {
          sql = sql.replace(/'Unknown'/g, 'NULL');
          sql = sql.trim().replace(/;$/, '') + ' ON CONFLICT (id) DO NOTHING;';
        }
        // Run SQL statements
        await client.query(sql);
        console.log(`Successfully restored ${file}`);
      } else {
        console.warn(`Warning: Data file ${file} does not exist. Skipping...`);
      }
    }

    // 7. Restore original replication role
    console.log('\n--- Restoring origin replication role ---');
    await client.query("SET session_replication_role = 'origin';");

    console.log('\n🎉 Database restoration completed successfully!');
  } catch (err) {
    console.error('❌ Error occurred during database restoration:', err);
  } finally {
    await client.end();
  }
}

run();
