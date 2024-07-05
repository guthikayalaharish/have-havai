import "reflect-metadata";
import { DataSource, Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import express, { Request, Response } from "express";
import * as xlsx from "xlsx";

// Define database entities
@Entity()
class Country {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    country_code_two: string;

    @Column()
    country_code_three: string;

    @Column()
    mobile_code: number;

    @Column()
    continent_id: number;
}

@Entity()
class City {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    country_id: number;

    @Column()
    is_active: boolean;

    @Column("float")
    lat: number;

    @Column("float")
    long: number;

    @ManyToOne(() => Country, country => country.id)
    country: Country;
}

@Entity()
class Airport {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    icao_code: string;

    @Column()
    iata_code: string;

    @Column()
    name: string;

    @Column()
    type: string;

    @Column("float")
    latitude_deg: number;

    @Column("float")
    longitude_deg: number;

    @Column()
    elevation_ft: number;

    @Column()
    city_id: number;

    @ManyToOne(() => City, city => city.id)
    city: City;
}

// Set up TypeORM data source
const AppDataSource = new DataSource({
    type: "sqlite",
    database: "database.sqlite",
    synchronize: true,
    logging: false,
    entities: [Airport, City, Country],
    migrations: [],
    subscribers: [],
});

AppDataSource.initialize().then(async () => {
    const workbook = xlsx.readFile('/mnt/data/Database.xlsx');
    const countrySheet = xlsx.utils.sheet_to_json(workbook.Sheets['Country']);
    const citySheet = xlsx.utils.sheet_to_json(workbook.Sheets['City']);
    const airportSheet = xlsx.utils.sheet_to_json(workbook.Sheets['Airport']);

    const countryRepository = AppDataSource.getRepository(Country);
    const cityRepository = AppDataSource.getRepository(City);
    const airportRepository = AppDataSource.getRepository(Airport);

    await countryRepository.save(countrySheet);
    await cityRepository.save(citySheet);
    await airportRepository.save(airportSheet);

    console.log('Database synced and data populated.');
}).catch(error => console.log(error));

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Define API endpoint
app.get('/airport/:iata_code', async (req: Request, res: Response) => {
    const { iata_code } = req.params;

    try {
        const airport = await AppDataSource.getRepository(Airport).findOne({
            where: { iata_code },
            relations: {
                city: {
                    country: true
                }
            }
        });

        if (!airport) {
            return res.status(404).json({ error: 'Airport not found' });
        }

        const response = {
            airport: {
                id: airport.id,
                icao_code: airport.icao_code,
                iata_code: airport.iata_code,
                name: airport.name,
                type: airport.type,
                latitude_deg: airport.latitude_deg,
                longitude_deg: airport.longitude_deg,
                elevation_ft: airport.elevation_ft,
                address: {
                    city: {
                        id: airport.city.id,
                        name: airport.city.name,
                        country_id: airport.city.country_id,
                        is_active: airport.city.is_active,
                        lat: airport.city.lat,
                        long: airport.city.long
                    },
                    country: airport.city.country ? {
                        id: airport.city.country.id,
                        name: airport.city.country.name,
                        country_code_two: airport.city.country.country_code_two,
                        country_code_three: airport.city.country.country_code_three,
                        mobile_code: airport.city.country.mobile_code,
                        continent_id: airport.city.country.continent_id
                    } : null
                }
            }
        };

        res.json(response);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start the server
AppDataSource.initialize().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}).catch(error => console.log(error));
